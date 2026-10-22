import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUser } from '@/api';
import { useAuth } from '@/auth';
import type { DmndSession, HashrateRange } from '@/api/types';
import { downsampleHashrate, rangeToWindow } from '@/lib/hashrateHistory';
import { cachedHashrateHistory } from '@/lib/incrementalHistory';
import { mapConcurrent } from '@/lib/concurrency';
import { sumHashrateSeries } from '@/lib/aggregatedHashrate';
import { useSubaccountList } from './useSubaccounts';
import { useActiveAccountId } from './useActiveAccountId';
import { msUntilNextTick } from '@/lib/utils';
import { accountPayoutQueryOptions } from '@/lib/payoutQueries';

// The UI checks account data every five minutes.
const CLOUD_POLL_MS = 5 * 60 * 1000;

// The historical series is dense (~one sample every two minutes); cap the points
// the chart renders so Recharts stays smooth.
const MAX_CHART_POINTS = 300;

/** Live hashrate snapshot for the signed-in account (home live-hashrate card). */
export function useAccountHashrate(enabled = true) {
  const { session } = useAuth();
  const accountId = useActiveAccountId();
  return useQuery({
    queryKey: ['account', 'hashrate', accountId],
    queryFn: ({ signal }) => getUser().getHashrate({ signal, accountId: accountId ?? undefined }),
    enabled: !!session && enabled,
    refetchInterval: () => msUntilNextTick(CLOUD_POLL_MS),
    staleTime: CLOUD_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/**
 * Hashrate time series for the performance chart. The range toggle maps to an
 * RFC3339 from/to window (recomputed each fetch so it slides with "now"), and the
 * dense response is downsampled before it reaches the chart.
 */
export function useAccountHashrateHistory(
  range: HashrateRange,
  custom?: { from: string; to: string } | null,
  enabled = true,
) {
  const { session } = useAuth();
  const accountId = useActiveAccountId();
  // A custom window is a fixed span, so it does not slide with "now" and its key is
  // the explicit from/to; a preset recomputes its window on each fetch.
  const key = custom ? `custom:${custom.from}:${custom.to}` : range;
  const cache = useQueryClient();
  return useQuery({
    queryKey: ['account', 'hashrate-history', key, accountId],
    queryFn: async () => {
      const window = custom ?? rangeToWindow(range, Date.now());
      const points = await cachedHashrateHistory(cache, ['account', 'hashrate-history-raw', key, accountId], window,
        (from, to, signal) => getUser().getHashrateHistory(from, to, { signal, accountId: accountId! }), !!custom);
      return downsampleHashrate(points, MAX_CHART_POINTS);
    },
    enabled: !!session && enabled,
    // A custom (historical) window doesn't need polling; presets stay live.
    refetchInterval: custom ? false : () => msUntilNextTick(CLOUD_POLL_MS),
    staleTime: CLOUD_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/**
 * Full account profile (checkAuth): the pool tokens for the connect-workers card
 * and the 2FA / payout state for the getting-started checklist. These values are
 * mostly stable. While KYB is under review, refresh it with the rest of the account
 * data so the status can update without requiring a reload.
 */
export function useAccountProfile() {
  const { session } = useAuth();
  const accountId = useActiveAccountId();
  return useQuery({
    queryKey: ['account', 'profile', accountId],
    queryFn: ({ signal }) => getUser().checkAuth({ signal, accountId: accountId ?? undefined }),
    enabled: !!session,
    refetchInterval: (query) => (query.state.data?.kyb_status === 'InReview' ? CLOUD_POLL_MS : false),
    staleTime: CLOUD_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/**
 * The combined hashrate series across the main account and every subaccount, for the
 * chart in aggregated mode. Every account is fetched over the same window in raw H/s and
 * the readings sharing a timestamp are added. A failed account rejects the query so the
 * chart shows its error state rather than a line that silently omits an account.
 */
export function useAggregatedHashrateHistory(
  range: HashrateRange,
  custom?: { from: string; to: string } | null,
  enabled = true,
) {
  const { session } = useAuth();
  const ownerAccountId = session?.accountId ?? null;
  const { data: subs } = useSubaccountList();
  const queryClient = useQueryClient();
  const key = custom ? `custom:${custom.from}:${custom.to}` : range;
  return useQuery({
    queryKey: ['account', 'hashrate-history', 'aggregated', key, ownerAccountId, subs?.map((sub) => sub.id)],
    queryFn: async ({ signal }) => {
      const owners = subs ?? [];
      const window = custom ?? rangeToWindow(range, Date.now());
      const client = getUser();
      const ownerProfile = queryClient.fetchQuery({
        queryKey: ['account', 'profile', ownerAccountId],
        queryFn: ({ signal: profileSignal }) => client.checkAuth({
          signal: profileSignal,
          accountId: ownerAccountId ?? undefined,
        }),
        // The mining credentials used for delegation are stable for the login.
        // Explicit profile invalidation still refreshes this cache when settings change.
        staleTime: Infinity,
        retry: false,
      });
      const [mainPoints, subSeries] = await Promise.all([
        cachedHashrateHistory(queryClient, ['account', 'hashrate-history-raw', key, ownerAccountId], window,
          (from, to, signal) => client.getHashrateHistory(from, to, { signal, accountId: ownerAccountId! }), !!custom),
        ownerProfile.then((profile) => mapConcurrent(owners, (s) => {
          signal.throwIfAborted();
          return cachedHashrateHistory(queryClient, ['account', 'hashrate-history-raw', key, s.id], window,
            (from, to, signal) => client.getSubaccountHashrateHistory(s.id, from, to, profile.token, s.token, { signal, accountId: ownerAccountId! }), !!custom);
        })),
      ]);
      return downsampleHashrate(sumHashrateSeries([mainPoints, ...subSeries]), MAX_CHART_POINTS);
    },
    enabled: !!session && enabled && subs !== undefined,
    refetchInterval: custom ? false : () => msUntilNextTick(CLOUD_POLL_MS),
    staleTime: CLOUD_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/**
 * The account's own 24h share counts. The single-account home and aggregated roll-up
 * both use this endpoint so rejection rate always has the same explicit time window.
 */
export function useAccountShareStats(enabled = true) {
  const { session } = useAuth();
  const accountId = useActiveAccountId();
  return useQuery({
    queryKey: ['account', 'share-stats', accountId],
    queryFn: ({ signal }) => getUser().getShareStats({ signal, accountId: accountId ?? undefined }),
    enabled: !!session && enabled,
    refetchInterval: () => msUntilNextTick(CLOUD_POLL_MS),
    staleTime: CLOUD_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/** The full worker roster (every page) for the active account. */
export function useAccountAllWorkers(enabled = true) {
  const { session } = useAuth();
  const accountId = useActiveAccountId();
  return useQuery({
    queryKey: ['account', 'workers-all', accountId],
    queryFn: ({ signal }) => getUser().getAllWorkers({ signal, accountId: accountId ?? undefined }),
    enabled: !!session && enabled,
    refetchInterval: () => msUntilNextTick(CLOUD_POLL_MS),
    staleTime: CLOUD_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/**
 * All the user's bitcoin addresses
 */
export function userBitcoinAddresses(profile: DmndSession | undefined): Set<string> {
  return new Set(Object.keys(profile?.bitcoin_addresses ?? {}).filter(Boolean));
}

/** Stable query-key fragment for data whose client-side ownership filter uses these addresses. */
export function userBitcoinAddressesKey(profile: DmndSession | undefined): string {
  return JSON.stringify([...userBitcoinAddresses(profile)].sort());
}

export function activeBitcoinAddress(profile: DmndSession | undefined): string | null {
  const active = Object.entries(profile?.bitcoin_addresses ?? {}).find(([address, isActive]) => isActive && address);
  return active?.[0] ?? null;
}

/**
 * Confirmed payouts for today's UTC date. Single mode uses the exact account endpoint;
 * aggregated mode reads the complete account tree once, avoiding duplicate shared-address outputs.
 */
export function useTodayEarnings(enabled = true, aggregated = false) {
  const { session } = useAuth();
  const ownerAccountId = session?.accountId ?? null;
  const accountId = useActiveAccountId();
  const today = new Date().toISOString().slice(0, 10);
  return useQuery({
    ...accountPayoutQueryOptions(getUser(), ownerAccountId, accountId, aggregated),
    select: (records) => records
      .filter((record) => new Date(record.confirmed_at * 1000).toISOString().slice(0, 10) === today)
      .reduce((sum, record) => sum + record.amount_sats, 0) / 1e8,
    enabled: enabled && !!session && !!accountId,
  });
}
