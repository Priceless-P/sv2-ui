import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUser } from '@/api';
import { useAuth } from '@/auth';
import { ACCOUNT_POLL_MS, loadSubaccountWorkerGroups } from '@/lib/accountQueries';
import { subaccountName } from '@/lib/subaccountsTable';
import { MAIN_ACCOUNT_LABEL } from '@/lib/payoutsTable';
import { useSubaccountList } from './useSubaccounts';
import { useAccountAllWorkers } from './useAccountData';

export function useAggregatedWorkers(enabled: boolean) {
  const { session } = useAuth();
  const cache = useQueryClient();
  const list = useSubaccountList();
  const main = useAccountAllWorkers(enabled);
  const groups = useQuery({
    queryKey: ['account', 'aggregate-workers', session?.accountId, list.data?.map((sub) => [sub.id, subaccountName(sub)])],
    queryFn: ({ signal }) => loadSubaccountWorkerGroups(cache, getUser(), session!.accountId, list.data!, signal),
    enabled: enabled && !!session && list.isSuccess,
    staleTime: ACCOUNT_POLL_MS,
    refetchInterval: ACCOUNT_POLL_MS,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const accounts = useMemo(() => [
    { id: session?.accountId ?? '', name: MAIN_ACCOUNT_LABEL, workers: main.data ?? [] },
    ...(groups.data ?? []).map(({ sub, workers }) => ({ id: sub.id, name: subaccountName(sub), workers })),
  ], [session?.accountId, main.data, groups.data]);
  return {
    accounts,
    isLoading: list.isLoading || main.isLoading || groups.isLoading,
    isError: list.isError || main.isError || groups.isError,
    refetch: () => Promise.all([main.refetch(), groups.refetch()]),
  };
}
