import { useQuery } from '@tanstack/react-query';
import { getUser } from '@/api';
import { useAuth } from '@/auth';
import type { DmndSession, HashrateRange } from '@/api/types';
import { downsampleHashrate, rangeToWindow } from '@/lib/hashrateHistory';
import { subaccountSeriesToPoints, sumHashrateSeries } from '@/lib/aggregatedHashrate';
import { useSubaccountList } from './useSubaccounts';
import { fetchConfirmedTxsSince, startOfUtcDaySec, sumOutputsTo } from '@/lib/blockstream';
import { useActiveAccountId } from './useActiveAccountId';

// The UI checks account data every five minutes.
const CLOUD_POLL_MS = 5 * 60 * 1000;

// The historical series is dense (~one sample every two minutes); cap the points
// the chart renders so Recharts stays smooth.
const MAX_CHART_POINTS = 300;

// Blockstream is a public third-party API (and this whole path is temporary), so
// today's earnings polls gently and is cached, not on the 5-min cloud cadence.
const EARNINGS_POLL_MS = 15 * 60 * 1000;

/** Live hashrate snapshot for the signed-in account (home live-hashrate card). */
export function useAccountHashrate() {
  const { session } = useAuth();
  const accountId = useActiveAccountId();
  return useQuery({
    queryKey: ['account', 'hashrate', accountId],
    queryFn: ({ signal }) => getUser().getHashrate({ signal, accountId: accountId ?? undefined }),
    enabled: !!session,
    refetchInterval: CLOUD_POLL_MS,
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
export function useAccountHashrateHistory(range: HashrateRange, custom?: { from: string; to: string } | null) {
  const { session } = useAuth();
  const accountId = useActiveAccountId();
  // A custom window is a fixed span, so it does not slide with "now" and its key is
  // the explicit from/to; a preset recomputes its window on each fetch.
  const key = custom ? `custom:${custom.from}:${custom.to}` : range;
  return useQuery({
    queryKey: ['account', 'hashrate-history', key, accountId],
    queryFn: async ({ signal }) => {
      const window = custom ?? rangeToWindow(range, Date.now());
      const points = await getUser().getHashrateHistory(window.from, window.to, {
        signal,
        accountId: accountId ?? undefined,
      });
      return downsampleHashrate(points, MAX_CHART_POINTS);
    },
    enabled: !!session,
    // A custom (historical) window doesn't need polling; presets stay live.
    refetchInterval: custom ? false : CLOUD_POLL_MS,
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

/** Per-worker roster for a date range; used by the workers page. */
export function useAccountWorkers(from: string, to: string) {
  const { session } = useAuth();
  const accountId = useActiveAccountId();
  return useQuery({
    queryKey: ['account', 'workers', from, to, accountId],
    queryFn: ({ signal }) => getUser().getWorkers(from, to, { signal, accountId: accountId ?? undefined }),
    enabled: !!session && !!from && !!to,
    refetchInterval: CLOUD_POLL_MS,
    staleTime: CLOUD_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/**
 * The combined hashrate series across the main account and every subaccount, for the
 * chart in aggregated mode. Each account is fetched over the same window and the
 * readings sharing a timestamp are added; the per-subaccount endpoint reports each
 * figure with a unit while the account-level one returns bare H/s, so subaccount points
 * are normalised before being summed. A failed account rejects the query so the chart
 * shows its error state rather than a line that silently omits an account's hashrate.
 */
export function useAggregatedHashrateHistory(
  range: HashrateRange,
  custom?: { from: string; to: string } | null,
  enabled = true,
) {
  const { session } = useAuth();
  const ownerAccountId = session?.accountId ?? null;
  const { data: subs } = useSubaccountList();
  const key = custom ? `custom:${custom.from}:${custom.to}` : range;
  return useQuery({
    queryKey: ['account', 'hashrate-history', 'aggregated', key, ownerAccountId],
    queryFn: async ({ signal }) => {
      const client = getUser();
      const owners = subs ?? [];
      const window = custom ?? rangeToWindow(range, Date.now());
      const [mainPoints, subSeries] = await Promise.all([
        client.getHashrateHistory(window.from, window.to, { signal, accountId: ownerAccountId ?? undefined }),
        Promise.all(
          owners.map((s) =>
            client
              .getSubaccountHashrateHistory(s.id, s.token, window.from, window.to, {
                signal,
                accountId: ownerAccountId ?? undefined,
              })
              .then(subaccountSeriesToPoints),
          ),
        ),
      ]);
      return downsampleHashrate(sumHashrateSeries([mainPoints, ...subSeries]), MAX_CHART_POINTS);
    },
    enabled: !!session && enabled && subs !== undefined,
    refetchInterval: custom ? false : CLOUD_POLL_MS,
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
    refetchInterval: CLOUD_POLL_MS,
    staleTime: CLOUD_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/** The full worker roster (every page) for the home's Active / Offline counts. */
export function useAccountAllWorkers() {
  const { session } = useAuth();
  const accountId = useActiveAccountId();
  return useQuery({
    queryKey: ['account', 'workers-all', accountId],
    queryFn: ({ signal }) => getUser().getAllWorkers({ signal, accountId: accountId ?? undefined }),
    enabled: !!session,
    refetchInterval: CLOUD_POLL_MS,
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

export function activeBitcoinAddress(profile: DmndSession | undefined): string | null {
  const active = Object.entries(profile?.bitcoin_addresses ?? {}).find(([address, isActive]) => isActive && address);
  return active?.[0] ?? null;
}

/**
 * Today's earnings in BTC, from on-chain payouts (temporary: a pool-wallet API will
 * replace Blockstream). The pool's FPPS/PPLNS payout wallets pay the miner's OWN
 * bitcoin address, so we page each payout wallet's confirmed txs newest-first, stop
 * at the first tx older than today (UTC), and sum the outputs paying one of the
 * user's addresses. The payout-address lookup carries the DMND session; the
 * Blockstream calls carry NO DMND auth (different origin). If any wallet fetch
 * fails the query errors so the card shows "--" instead of a false or partial 0; a
 * genuine zero (no payout today) still returns 0.
 */
export function useTodayEarnings() {
  const { session } = useAuth();
  const accountId = useActiveAccountId();
  const { data: profile } = useAccountProfile();
  return useQuery({
    queryKey: ['account', 'today-earnings', accountId],
    queryFn: async ({ signal }) => {
      const userAddrs = userBitcoinAddresses(profile);
      if (userAddrs.size === 0) return 0; // no receiving address set -> nothing to receive
      const payout = await getUser().getPayoutAddresses({ signal, accountId: accountId ?? undefined });
      const wallets = [...new Set([payout.fpps_payout_address, payout.pplns_payout_address].filter(Boolean))];
      if (wallets.length === 0) return 0;
      const since = startOfUtcDaySec(Date.now());
      const perWallet = await Promise.all(
        wallets.map((wallet) =>
          fetchConfirmedTxsSince(wallet, since, { signal }).then((txs) => sumOutputsTo(txs, userAddrs)),
        ),
      );
      const sats = perWallet.reduce((total, s) => total + s, 0);
      return sats / 1e8;
    },
    enabled: !!session && !!profile,
    refetchInterval: EARNINGS_POLL_MS,
    staleTime: EARNINGS_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
