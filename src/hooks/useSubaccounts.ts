import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getUser } from '@/api';
import { useAuth } from '@/auth';
import type { CreateSubaccountInput } from '@/api/types';
import { type EnrichedSubaccount } from '@/lib/subaccountsTable';
import { loadSubaccountRows } from '@/lib/accountQueries';
import { useActiveAccountId } from './useActiveAccountId';
import { msUntilNextTick } from '@/lib/utils';

// The UI checks every five minutes
const CLOUD_POLL_MS = 5 * 60 * 1000;

/**
 * The account's subaccounts, each enriched with its summary (rejection + today's
 * earnings in one response). Worker rosters are opt-in for aggregate Home; the
 * Subaccounts page does not request or display worker counts.
 */
export function useSubaccounts(enabled = true, includeWorkers = false, refreshIntervalMs = CLOUD_POLL_MS) {
  const { session } = useAuth();
  const ownerAccountId = session?.accountId ?? null;
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ['account', 'subaccounts', ownerAccountId, { includeWorkers }],
    queryFn: async ({ signal }): Promise<EnrichedSubaccount[]> => {
      return loadSubaccountRows(queryClient, getUser(), ownerAccountId!, includeWorkers, signal);
    },
    enabled: !!session && enabled,
    refetchInterval: () => msUntilNextTick(refreshIntervalMs),
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
