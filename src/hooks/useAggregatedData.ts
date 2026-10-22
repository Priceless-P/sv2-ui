import { useMemo } from 'react';
import { donutSlices, sumAccountStats } from '@/lib/aggregatedStats';
import { MAIN_ACCOUNT_LABEL } from '@/lib/payoutsTable';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUser } from '@/api';
import { useAuth } from '@/auth';
import { deriveWorkersPageStats } from '@/lib/workersTable';
import { subaccountName, type EnrichedSubaccount } from '@/lib/subaccountsTable';
import { ACCOUNT_POLL_MS, loadSubaccountWorkerGroups, useSubaccounts, useSubaccountList } from './useSubaccounts';
import { useAccountAllWorkers } from './useAccountData';
import { msUntilNextTick } from '@/lib/utils';

/** Home roll-up: each existing summary supplies rates, shares, and today's generated BTC. */
export function useAggregatedData(enabled = true, includeWorkers = true) {
  const { session } = useAuth();
  const ownerId = session?.accountId;
  const { data, isLoading: subaccountsLoading, isError: subaccountsError, refetch: refetchSubaccounts } = useSubaccounts(enabled, includeWorkers);
  const { data: mainWorkers, isLoading: mainWorkersLoading, isError: mainWorkersError, refetch: refetchMainWorkers } = useAccountAllWorkers(enabled && includeWorkers);
  // The same subaccount endpoint accepts the owner's own ID through sub_account_auth.
  const main = useQuery({
    queryKey: ['account', 'subaccount-summary', ownerId, ownerId],
    queryFn: ({ signal }) => getUser().getSubaccountSummary(ownerId!, { signal, accountId: ownerId }),
    enabled: enabled && !!ownerId,
    staleTime: ACCOUNT_POLL_MS,
    refetchInterval: () => msUntilNextTick(ACCOUNT_POLL_MS),
    refetchOnWindowFocus: false,
    retry: false,
  });

  const subs = useMemo(
    () => data ?? [],
    [data],
  );
  // The main account expressed in the same per-account shape as an enriched subaccount,
  // so one roll-up covers every account without a second code path.
  const mainAccount = useMemo<EnrichedSubaccount>(() => {
    const workers = mainWorkers ?? [];
    const stats = deriveWorkersPageStats(workers);
    return {
      id: MAIN_ACCOUNT_LABEL,
      name: MAIN_ACCOUNT_LABEL,
      hashrate: main.data?.hashrate.total_hashrate ?? 0,
      pplns: main.data?.hashrate.pplns_hashrate ?? 0,
      fpps: main.data?.hashrate.fpps_hashrate ?? 0,
      active: stats.active,
      offline: stats.offline,
      pplnsPassword: '',
      fppsPassword: null,
      rejection: stats.rejectionRate,
      accepted: main.data?.share_stats.accepted ?? 0,
      rejected: main.data?.share_stats.rejected ?? 0,
      todayEarnings: main.data?.today_generated_btc ?? 0,
      generatedBtc: null,
      workers,
    };
  }, [mainWorkers, main.data]);

  // Main first, matching how the account switcher and the payout account list order
  // themselves, so the same account leads every aggregated surface.
  const accounts = useMemo(() => [mainAccount, ...subs], [mainAccount, subs]);
  const stats = useMemo(() => sumAccountStats(accounts), [accounts]);
  const slices = useMemo(() => donutSlices(accounts), [accounts]);

  return {
    stats,
    slices,
    accounts,
    subaccounts: subs,
    isLoading: subaccountsLoading || mainWorkersLoading || main.isLoading,
    isError: subaccountsError || (includeWorkers && mainWorkersError) || main.isError,
    refetch: () => Promise.all([refetchSubaccounts(), ...(includeWorkers ? [refetchMainWorkers()] : []), main.refetch()]),
  };
}

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
