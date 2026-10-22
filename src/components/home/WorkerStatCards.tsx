import type { Worker, HashrateSnapshot, SubaccountShareStats, SubaccountFees } from '@/api/types';
import { Children, type ReactNode } from 'react';
import { StatCard } from '@/components/ui/StatCard';
import { formatFeePercent, totalPoolFee } from '@/lib/watcherLinks';
import { WorkerBars } from '@/components/ui/WorkerBars';
import { useAccountAllWorkers, useAccountHashrate, useAccountShareStats, useTodayEarnings } from '@/hooks/useAccountData';
import { deriveWorkerStats } from '@/lib/workerStats';
import { BTC_DISPLAY_DP, cn } from '@/lib/utils';
import { formatAxisValue, pickHashrateScale } from '@/lib/chartAxis';
import type { AggregatedStats } from '@/lib/aggregatedStats';
import { ACCOUNT_REJECTION_HINT, ACTIVE_WORKERS_HINT, WORKER_METRICS_HINT } from '@/lib/metricWindows';

function formatBtc(btc: number): string {
  if (btc === 0) return '0 BTC';
  return `${btc.toFixed(BTC_DISPLAY_DP).replace(/\.?0+$/, '')} BTC`;
}

/**
 * Active / Offline / Rejection / Today's earnings cards. Worker counts come from
 * the full roster; today's earnings is derived from on-chain payouts (see
 * useTodayEarnings), not a hardcoded value. While the earnings lookup is loading or
 * fails it shows "--" (unknown) rather than a misleading 0; a genuine zero shows
 * "0 BTC".
 */
export function WorkerStatCards({ aggregated }: { aggregated?: AggregatedStats }) {
  const { data: workers } = useAccountAllWorkers();
  const { data: shareStats } = useAccountShareStats(aggregated === undefined);
  const { data: hashrate } = useAccountHashrate(aggregated === undefined);
  const earningsQuery = useTodayEarnings(true, aggregated !== undefined);
  const earnings = earningsQuery.isSuccess ? earningsQuery.data : undefined;
  return <WorkerStatCardsView workers={workers} shareStats={shareStats} hashrate={hashrate} earnings={earnings} aggregated={aggregated} />;
}

/** Data-only dashboard metrics. Visibility is explicit so public views cannot imply access to another scope. */
export function WorkerStatCardsView({ workers, shareStats, hashrate, earnings, aggregated, showWorkers = true, showHashrate = true, showRejection = true, showEarnings = true, children }: {
  workers?: Worker[];
  shareStats?: SubaccountShareStats;
  hashrate?: HashrateSnapshot;
  earnings?: number;
  aggregated?: AggregatedStats;
  showWorkers?: boolean;
  showHashrate?: boolean;
  showRejection?: boolean;
  showEarnings?: boolean;
  children?: ReactNode;
}) {
  const roster = workers ?? [];
  const workersKnown = aggregated !== undefined || workers !== undefined;
  const single = deriveWorkerStats(roster);
  const shareTotal = (shareStats?.accepted ?? 0) + (shareStats?.rejected ?? 0);
  const singleRejection = shareTotal > 0 ? (shareStats?.rejected ?? 0) / shareTotal : null;
  // In aggregated mode every figure is the roll-up across subaccounts, so the cards
  // can never show one account's numbers while the rest of the page shows the total.
  const stats = aggregated
    ? {
      activeCount: aggregated.activeWorkers,
      totalCount: aggregated.totalWorkers,
      offlineCount: aggregated.offlineWorkers,
      rejectionRate: aggregated.rejectionRate,
    }
    : { ...single, rejectionRate: singleRejection };
  const todayEarnings = earnings;
  const totalHashrate = aggregated ? aggregated.combinedHashrate : hashrate?.total_hashrate;
  // No active worker means no rate to divide, which is unknown rather than zero.
  const perWorker = workersKnown && stats.activeCount > 0 && totalHashrate !== undefined ? totalHashrate / stats.activeCount : null;
  const perWorkerScale = pickHashrateScale([perWorker ?? 0]);
  const hasWorkers = stats.totalCount > 0;
  const hasMined = stats.rejectionRate !== null;
  const rejection = stats.rejectionRate === null ? '--' : (stats.rejectionRate * 100).toFixed(2);
  const cardCount = Number(showWorkers) + Number(showWorkers && showHashrate) + Number(showRejection) + Number(showEarnings) + Children.toArray(children).length;

  return (
    <div className={cn('grid grid-cols-1 gap-2', cardCount > 1 && 'sm:grid-cols-2', cardCount === 3 && 'lg:grid-cols-3', cardCount === 4 && 'lg:grid-cols-4')}>
      {showWorkers && <StatCard
        tour="stats-workers"
        title="Active workers"
        value={workersKnown ? stats.activeCount : '--'}
        unit={workersKnown ? `/${stats.totalCount}` : undefined}
        unitSize="base"
        meter={aggregated && hasWorkers ? <WorkerBars active={stats.activeCount} total={stats.totalCount} /> : undefined}
        // Once workers exist, show the live split; before that, the empty hint.
        caption={
          !workersKnown ? 'Worker statistics unavailable.' : hasWorkers ? `${stats.activeCount} active • ${stats.offlineCount} offline` : 'Connected workers will appear here.'
        }
        hint={ACTIVE_WORKERS_HINT}
      />}
      {showWorkers && showHashrate && <StatCard
        tour="stats-workers"
        title="Average hashrate"
        value={perWorker === null ? '--' : formatAxisValue(perWorker, perWorkerScale.divisor)}
        unit={perWorker === null ? undefined : perWorkerScale.unit}
        unitSize="base"
        captionTone={perWorker === null ? 'muted' : 'strong'}
        caption={
          perWorker === null
            ? 'Average hashrate of all active workers'
            : `Averaged over ${stats.activeCount} active worker${stats.activeCount === 1 ? '' : 's'}`
        }
        hint={WORKER_METRICS_HINT}
      />}
      {showRejection && <StatCard
        tour="stats-earnings"
        title="Rejection rate"
        value={rejection}
        unit={hasMined ? '%' : undefined}
        captionTone={hasMined ? 'strong' : 'muted'}
        caption={hasMined ? 'Last 24 hours across all shares.' : 'Rejected share rate will appear after mining starts.'}
        hint={ACCOUNT_REJECTION_HINT}
      />}
      {showEarnings && <TodayEarningsCard earnings={todayEarnings} aggregated={aggregated !== undefined} />}
      {children}
    </div>
  );
}

/** Shared earnings card, also used independently in the watcher overview row. */
export function TodayEarningsCard({ earnings: todayEarnings, aggregated = false }: {
  earnings?: number;
  aggregated?: boolean;
}) {
  const earningsKnown = todayEarnings !== undefined;
  const earningsValue = earningsKnown ? formatBtc(todayEarnings) : '--';
  return (
    <StatCard
      tour="stats-earnings"
      title="Today's earnings"
      value={earningsKnown ? earningsValue.replace(' BTC', '') : '--'}
      unit={earningsKnown ? 'BTC' : undefined}
      captionTone={earningsKnown && todayEarnings > 0 ? 'strong' : 'muted'}
      caption={aggregated ? 'Paid out today across all accounts (UTC).' : 'Confirmed payouts today (UTC).'}
      hint={
        aggregated
          ? 'Confirmed payouts today (UTC) across the main account and all subaccounts.'
          : 'Confirmed payouts sent to this account today (UTC).'
      }
    />
  );
}

/** Only supplied (token-permitted) readings appear in this combined card. */
export function WatcherDataCard({ shares }: {
  shares?: { data?: SubaccountShareStats | null; isLoading: boolean; isError: boolean };
}) {
  const stats = shares?.data;
  const total = stats ? stats.accepted + stats.rejected : 0;
  const sharesKnown = !!stats && !shares?.isLoading && !shares?.isError;
  const caption = shares?.isLoading ? 'Loading share statistics…' : shares && !sharesKnown ? 'Share statistics unavailable.' : undefined;

  return (
    <StatCard title="Watcher data" caption={caption} hint={shares ? ACCOUNT_REJECTION_HINT : undefined}>
      <dl className="divide-y divide-border text-sm">
        {shares && <>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 py-2 first:pt-0 last:pb-0">
            <dt className="text-body-alt">Rejection rate</dt>
            <dd className="font-medium tabular-nums text-foreground">{sharesKnown && total > 0 ? `${((stats.rejected / total) * 100).toFixed(2)}%` : '--'}</dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 py-2 first:pt-0 last:pb-0">
            <dt className="text-body-alt">Accepted shares</dt>
            <dd className="font-medium tabular-nums text-foreground">{sharesKnown ? stats.accepted.toLocaleString() : '--'}</dd>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 py-2 first:pt-0 last:pb-0">
            <dt className="text-body-alt">Rejected shares</dt>
            <dd className="font-medium tabular-nums text-foreground">{sharesKnown ? stats.rejected.toLocaleString() : '--'}</dd>
          </div>
        </>}
      </dl>
    </StatCard>
  );
}

/** Home metric card; API fees are already percentages. */
export function PoolFeeCard({ data, isLoading, isError }: {
  data?: SubaccountFees | null;
  isLoading: boolean;
  isError: boolean;
}) {
  const known = !!data && !isLoading && !isError;
  return (
    <StatCard
      title="Pool fee"
      value={known ? formatFeePercent(totalPoolFee(data)) : '--'}
      unit={known ? '%' : undefined}
      caption={isLoading ? 'Loading fees…' : !known ? 'Fee rates unavailable.' : 'Charged by the Pool'}
    />
  );
}
