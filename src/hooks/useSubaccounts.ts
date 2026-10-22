import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { getUser } from '@/api';
import { useAuth } from '@/auth';
import type { CreateSubaccountInput, DmndClient, Subaccount } from '@/api/types';
import { enrichSubaccount, type EnrichedSubaccount } from '@/lib/subaccountsTable';
import { mapConcurrent } from '@/lib/concurrency';
import { useActiveAccountId } from './useActiveAccountId';
import { msUntilNextTick } from '@/lib/utils';

// The UI checks every five minutes
const CLOUD_POLL_MS = 5 * 60 * 1000;

/**
 * The account's subaccounts, each enriched with its summary (rejection + today's
 * earnings in one response). Worker rosters are opt-in for aggregate Home; the
 * Subaccounts page does not request or display worker counts.
 */
export function useSubaccounts(enabled = true, includeWorkers = false, refreshIntervalMs: number | false = CLOUD_POLL_MS) {
  const { session } = useAuth();
  const ownerAccountId = session?.accountId ?? null;
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['account', 'subaccounts', ownerAccountId, { includeWorkers }],
    queryFn: async ({ signal }): Promise<EnrichedSubaccount[]> => {
      return loadSubaccountRows(queryClient, getUser(), ownerAccountId!, includeWorkers, signal);
    },
    enabled: !!session && enabled,
    refetchInterval: refreshIntervalMs === false ? false : () => msUntilNextTick(refreshIntervalMs),
    staleTime: CLOUD_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/**
 * The raw subaccount rows, without the per-row enrichment calls. Callers that only
 * need to map an id to a name (rather than render the subaccounts table) use this so
 * they cost one request instead of two per subaccount, and so an enrichment failure
 * cannot take their page down with it.
 */
export function useSubaccountList() {
  const { session } = useAuth();
  const ownerAccountId = session?.accountId ?? null;
  return useQuery({
    queryKey: ['account', 'subaccounts', 'list', ownerAccountId],
    queryFn: ({ signal }) =>
      getUser().getSubaccounts({ signal, accountId: ownerAccountId ?? undefined }),
    enabled: !!session,
    staleTime: CLOUD_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/**
 * Whether the account has any subaccounts, from the list endpoint alone, sharing
 * useSubaccountList's cache (no separate query). Kept separate from useSubaccounts so
 * gating UI (the aggregated-mode toggle) never triggers the heavy per-sub fan-out on
 * a page that only needs the count.
 */
export function useHasSubaccounts() {
  const query = useSubaccountList();
  return { hasSubaccounts: (query.data?.length ?? 0) > 0, isLoading: query.isLoading };
}

/**
 * Capability flags for the account. Stable for a session, so fetched once and not
 * polled; gates the Create button (create_sub_account) and page (view_sub_accounts).
 */
export function usePermissions() {
  const { session } = useAuth();
  const accountId = useActiveAccountId();
  return useQuery({
    queryKey: ['account', 'permissions', accountId],
    queryFn: ({ signal }) => getUser().getPermissions({ signal, accountId: accountId ?? undefined }),
    enabled: !!session,
    staleTime: CLOUD_POLL_MS,
    refetchOnWindowFocus: true,
    retry: false,
  });
}

/** Create a subaccount, then refresh the list so the new row appears. */
export function useCreateSubaccount() {
  const queryClient = useQueryClient();
  const { session, viewingAccountId } = useAuth();
  const permissions = usePermissions();
  return useMutation({
    mutationFn: (input: CreateSubaccountInput) => {
      if (!session || viewingAccountId || !permissions.isSuccess || !permissions.data.create_sub_account) {
        throw new Error('Only the main account can create subaccounts.');
      }
      return getUser().createSubaccount(input, { accountId: session.accountId });
    },
    retry: false,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['account', 'subaccounts'] }),
  });
}

export const ACCOUNT_POLL_MS = 5 * 60 * 1000;

/** Share reads within a polling period, but refresh at the next chart/live tick. */
function accountPollStaleTime() {
  return Math.max(1, Date.now() % ACCOUNT_POLL_MS);
}

export function subaccountWorkersQuery(cache: QueryClient, client: DmndClient, ownerId: string, id: string) {
  return cache.fetchQuery({
    queryKey: ['account', 'workers-all', id],
    queryFn: async ({ signal }) => (await client.getSubaccountWorkers(id, { signal, accountId: ownerId })).workers,
    staleTime: accountPollStaleTime,
    retry: false,
  });
}

/** Subaccounts only requires summaries; full rosters are opt-in for aggregate Home. */
export async function loadSubaccountRows(
  cache: QueryClient, client: DmndClient, ownerId: string, includeWorkers: boolean, signal: AbortSignal,
) {
  const list = await cache.fetchQuery({
    queryKey: ['account', 'subaccounts', 'list', ownerId],
    queryFn: ({ signal }) => client.getSubaccounts({ signal, accountId: ownerId }),
    staleTime: accountPollStaleTime,
    retry: false,
  });
  return mapConcurrent(list, async (row) => {
    signal.throwIfAborted();
    const summary = await cache.fetchQuery({
      queryKey: ['account', 'subaccount-summary', ownerId, row.id],
      queryFn: ({ signal }) => client.getSubaccountSummary(row.id, { signal, accountId: ownerId }),
      staleTime: accountPollStaleTime,
      retry: false,
    });
    const workers = includeWorkers ? await subaccountWorkersQuery(cache, client, ownerId, row.id) : [];
    return enrichSubaccount(row, summary, workers);
  });
}

/** Workers pages read only rosters, without fees, shares, generated BTC, or history. */
export function loadSubaccountWorkerGroups(
  cache: QueryClient, client: DmndClient, ownerId: string, subs: Subaccount[], signal: AbortSignal,
) {
  return mapConcurrent(subs, async (sub) => {
    signal.throwIfAborted();
    return { sub, workers: await subaccountWorkersQuery(cache, client, ownerId, sub.id) };
  });
}

/** Refresh just the selected page, sharing individual summary reads with other views. */
export function visibleSubaccountQueryOptions(
  cache: QueryClient, client: DmndClient, ownerId: string | null, rows: EnrichedSubaccount[], snapshotRevision = 0,
) {
  return {
    queryKey: ['account', 'visible-subaccounts', ownerId, rows.map((row) => row.id), snapshotRevision],
    queryFn: ({ signal }: { signal: AbortSignal }) => mapConcurrent(rows, async (row) => {
      signal.throwIfAborted();
      const summary = await cache.fetchQuery({
        queryKey: ['account', 'subaccount-summary', ownerId, row.id],
        queryFn: ({ signal }) => client.getSubaccountSummary(row.id, { signal, accountId: ownerId! }),
        staleTime: accountPollStaleTime,
        retry: false,
      });
      return { ...row, hashrate: summary.hashrate.total_hashrate, pplns: summary.hashrate.pplns_hashrate,
        fpps: summary.hashrate.fpps_hashrate, rejection: summary.share_stats.accepted + summary.share_stats.rejected > 0
          ? summary.share_stats.rejected / (summary.share_stats.accepted + summary.share_stats.rejected) : null,
        accepted: summary.share_stats.accepted, rejected: summary.share_stats.rejected,
        todayEarnings: summary.today_generated_btc ?? 0 };
    }),
    staleTime: accountPollStaleTime,
    refetchInterval: () => msUntilNextTick(CLOUD_POLL_MS),
    refetchOnWindowFocus: false,
    retry: false,
  } as const;
}

export function useVisibleSubaccounts(rows: EnrichedSubaccount[], enabled: boolean, snapshotRevision: number) {
  const { session } = useAuth();
  const cache = useQueryClient();
  return useQuery({
    ...visibleSubaccountQueryOptions(cache, getUser(), session?.accountId ?? null, rows, snapshotRevision),
    enabled: enabled && !!session && rows.length > 0,
  });
}
