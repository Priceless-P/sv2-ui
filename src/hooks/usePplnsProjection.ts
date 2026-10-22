import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUser } from '@/api';
import { useActiveAccountId } from './useActiveAccountId';
import { useAuth } from '@/auth';
import { useSubaccountList } from './useSubaccounts';
import { combinePplnsDailyWork } from '@/lib/pplnsProjection';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export function usePplnsProjection(enabled = true) {
  const accountId = useActiveAccountId();
  return useQuery({
    queryKey: ['account', 'pplns-projection', accountId],
    queryFn: ({ signal }) => {
      if (!accountId) throw new Error('No account');
      return getUser().getPplnsProjection(accountId, { signal, accountId });
    },
    enabled: enabled && !!accountId,
    staleTime: REFRESH_INTERVAL_MS,
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/** All accounts must load successfully; a missing projection leaves the combined view unavailable. */
export function useAggregatedPplnsProjection(enabled = true) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const { data: subs } = useSubaccountList();
  const ownerId = session?.accountId;
  const accountIds = [...new Set([ownerId, ...(subs ?? []).map((sub) => sub.id)].filter((id): id is string => !!id))].sort();
  return useQuery({
    queryKey: ['account', 'pplns-projection', 'aggregated', ownerId, accountIds],
    queryFn: async ({ signal }) => {
      const projections = await Promise.all(accountIds.map((id) => queryClient.fetchQuery({
        queryKey: ['account', 'pplns-projection', id],
        queryFn: () => getUser().getPplnsProjection(id, { signal, accountId: ownerId }),
        staleTime: REFRESH_INTERVAL_MS,
        retry: false,
      })));
      if (projections.some((projection) => projection === null)) return null;
      return combinePplnsDailyWork(projections.map((projection) => projection!.daily_work));
    },
    enabled: enabled && !!session && subs !== undefined,
    staleTime: REFRESH_INTERVAL_MS,
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
