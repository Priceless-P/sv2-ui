import { downloadCsv as downloadCsvFile } from '@/lib/utils';
import type { GeneratedBtcEntry } from '@/api/types';
import { GeneratedBtcEmptyState } from '@/components/generated-btc/GeneratedBtcEmptyState';
import {
  EMPTY_GBTC_FILTER_DRAFT,
  gbtcDraftToFilter,
  GeneratedBtcFilter,
  isGbtcDraftActive,
  type GbtcFilterDraft,
} from '@/components/generated-btc/GeneratedBtcFilter';
import { GeneratedBtcTable } from '@/components/generated-btc/GeneratedBtcTable';
import { InfoHint } from '@/components/ui/InfoHint';
import { MINIMUM_PAYOUT_SATS, payoutProgress as calculatePayoutProgress } from '@/lib/generatedBtcTable';
import { formatBtcFromSats, type Payout } from '@/lib/payoutsTable';
import { usePayouts } from '@/hooks/usePayouts';
import { Reading } from '@/components/ui/Reading';
import { StatCard } from '@/components/ui/StatCard';
import { SelectionActions, TableToolbar } from '@/components/ui/TableToolbar';
import { WorkersPagination } from '@/components/workers/WorkersPagination';
import { formatAxisValue, pickHashrateScale } from '@/lib/chartAxis';
import {
  averageEntryHashrate,
  filterGeneratedBtc,
  filterGeneratedBtcByAccount,
  formatBtc,
  formatGeneratedDate,
  generatedBtcToCsv,
  generatedBtcRowId,
  highestEarningDay,
  hasFppsActivity,
  searchGeneratedBtc,
  sortGeneratedByDateDesc,
  sumGenerated,
} from '@/lib/generatedBtcTable';
import { GENERATED_AVG_HASHRATE_HINT } from '@/lib/metricWindows';
import { paginate } from '@/lib/workersTable';
import { useMemo, useState } from 'react';
import { LiUploadMinimalistic } from 'solar-icon-react/li';
import { useAggregatedModeContext } from '@/hooks/AggregatedModeProvider';
import { useAggregatedGeneratedBtc, useGeneratedBtc } from '@/hooks/useGeneratedBtc';
import { useSubaccountList } from '@/hooks/useSubaccounts';
import { MAIN_ACCOUNT_LABEL } from '@/lib/payoutsTable';
import { subaccountName } from '@/lib/subaccountsTable';
import { useActiveAccountId } from '@/hooks/useActiveAccountId';
import { combinedDailyEarnings } from '@/lib/generatedBtcTable';

const PAGE_SIZE = 10;

function downloadCsv(content: string): void {
  downloadCsvFile(content, 'generated_btc.csv');
}

/**
 * The Generated BTC page: the account's daily FPPS hashrate and generated BTC with
 * summary cards, a date filter, pagination, and CSV export.
 */
export function GeneratedBtcContent({ entries: allEntries, isLoading, isError, onRetry: refetch, accounts: accountNames, canConnect = false, canExport = false, payoutProgress }: {
  entries: GeneratedBtcEntry[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => unknown;
  accounts?: string[];
  canConnect?: boolean;
  canExport?: boolean;
  payoutProgress?: PayoutProgressData;
}) {
  const entries = useMemo(() => allEntries.filter(hasFppsActivity), [allEntries]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<GbtcFilterDraft>(EMPTY_GBTC_FILTER_DRAFT);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const sorted = useMemo(() => sortGeneratedByDateDesc(entries), [entries]);
  // Apply the date filter (preset cutoff or a custom range), the Account facet, and the
  // search box; the list is already newest-first. `now` is read at apply time, so no
  // per-render churn.
  const visible = useMemo(() => {
    const dateFiltered = filterGeneratedBtc(sorted, gbtcDraftToFilter(filter, Date.now()));
    const accountFiltered = filterGeneratedBtcByAccount(dateFiltered, filter.accounts);
    return searchGeneratedBtc(accountFiltered, query);
  }, [sorted, filter, query]);
  const pageData = paginate(visible, page, PAGE_SIZE);
  const allSelected = visible.length > 0 && visible.every((entry) => selected.has(generatedBtcRowId(entry)));
  const someSelected = visible.some((entry) => selected.has(generatedBtcRowId(entry)));
  const toggleAll = () => setSelected((previous) => {
    const next = new Set(previous);
    for (const entry of visible) {
      const id = generatedBtcRowId(entry);
      if (allSelected) next.delete(id);
      else next.add(id);
    }
    return next;
  });
  const toggleOne = (id: string) => setSelected((previous) => {
    const next = new Set(previous);
    if (!next.delete(id)) next.add(id);
    return next;
  });

  const aggregated = accountNames !== undefined;
  const totals = useMemo(
    () => {
      const dailyEntries = aggregated ? combinedDailyEarnings(entries) : entries;
      return {
      generated: sumGenerated(entries),
      averageHashrate: averageEntryHashrate(dailyEntries),
      highestDay: highestEarningDay(dailyEntries),
      totalDays: new Set(entries.map((entry) => entry.entry_day)).size,
      };
    },
    [entries, aggregated],
  );

  const changeQuery = (next: string) => {
    setQuery(next);
    setPage(1);
  };
  const applyFilter = (next: GbtcFilterDraft) => {
    setFilter(next);
    setPage(1);
  };
  const resetFilter = () => {
    setFilter(EMPTY_GBTC_FILTER_DRAFT);
    setPage(1);
  };

  const hasData = !isLoading && !isError && entries.length > 0;
  const filterActive = isGbtcDraftActive(filter);
  const hasQuery = query.trim().length > 0;
  const tableEmpty =
    visible.length > 0
      ? undefined
      : filterActive
        ? {
          title: 'No generated BTC matches this filter',
          hint: 'Adjust or clear your filters.',
          clearLabel: 'Clear filters',
          onClear: resetFilter,
        }
        : hasQuery
          ? {
            title: 'No generated BTC found',
            hint: 'Try a different date, hashrate, amount, or account name, or clear your search.',
            clearLabel: 'Clear search',
            onClear: () => changeQuery(''),
          }
          : undefined;

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-semibold leading-9 tracking-[-1px] text-heading">Generated BTC</h2>
          <p className="mt-1 text-sm text-body-alt">Track your mining rewards and earnings over time.</p>
        </div>
        {canExport && hasData && (
          <button
            type="button"
            onClick={() => downloadCsv(generatedBtcToCsv(someSelected ? visible.filter((entry) => selected.has(generatedBtcRowId(entry))) : visible))}
            className="inline-flex items-center gap-1.5 rounded-full bg-info px-5 py-2 text-sm font-medium text-info-foreground transition-opacity hover:opacity-90"
          >
            <LiUploadMinimalistic className="h-4 w-4" /> Export CSV
          </button>
        )}
      </header>

      {isLoading ? (
        <div className="h-80 animate-pulse rounded-xl border border-border bg-muted" />
      ) : isError ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-base font-semibold text-foreground">Couldn't load generated BTC</p>
          <p className="mt-1 text-sm text-body-alt">Something went wrong reading your mining rewards.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-4 inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Try again
          </button>
        </div>
      ) : entries.length === 0 ? (
        <>
          {payoutProgress && <PayoutProgressCard entries={entries} data={payoutProgress} isLoading={false} isError={false} />}
          <div className="border-t border-border"><GeneratedBtcEmptyState canConnect={canConnect} /></div>
        </>
      ) : (
        <>
          <GeneratedBtcStatCards
            generated={totals.generated}
            averageHashrate={totals.averageHashrate}
            highestDay={totals.highestDay}
            totalDays={totals.totalDays}
            aggregated={aggregated}
          />
          {payoutProgress && <PayoutProgressCard entries={entries} data={payoutProgress} isLoading={false} isError={false} />}
          <div>
            <TableToolbar
              title="Generated BTC"
              query={query}
              onQuery={changeQuery}
              searchPlaceholder="Search generated BTC"
              filterActive={filterActive}
              variant="framed"
              renderFilter={(onClose) => <GeneratedBtcFilter
                applied={filter}
                onApply={applyFilter}
                onReset={resetFilter}
                onClose={onClose}
                accounts={accountNames}
              />}
            />
            {canExport && <SelectionActions count={visible.filter((entry) => selected.has(generatedBtcRowId(entry))).length}
              onExport={() => downloadCsv(generatedBtcToCsv(visible.filter((entry) => selected.has(generatedBtcRowId(entry)))))}
              onClear={() => setSelected(new Set())} />}
            <GeneratedBtcTable
              entries={pageData.items}
              empty={tableEmpty}
              showAccount={accountNames !== undefined}
              selectable={canExport}
              selected={selected}
              allSelected={allSelected}
              someSelected={someSelected}
              onToggleAll={toggleAll}
              onToggleOne={toggleOne}
            />
            {visible.length > 0 && (
              <WorkersPagination page={pageData.page} totalPages={pageData.totalPages} onPage={setPage} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** FPPS generated BTC, average hashrate, highest earning day, and distinct recorded days. */
function GeneratedBtcStatCards({
  generated,
  averageHashrate,
  highestDay,
  totalDays,
  aggregated,
}: {
  generated: number;
  averageHashrate: number;
  highestDay: GeneratedBtcEntry | null;
  totalDays: number;
  aggregated: boolean;
}) {
  // One unit for the hashrate figure, matching how every other hashrate reading is set.
  const scale = pickHashrateScale([averageHashrate]);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard variant="generated" title="Total Generated BTC" caption={aggregated ? 'FPPS earnings across all accounts' : 'FPPS earnings over listed days'}>
        <Reading value={formatBtc(generated)} unit="BTC" unitSize="lg" />
      </StatCard>

      <StatCard variant="generated" title="Average FPPS hashrate" caption={aggregated ? 'Combined daily rate across all accounts' : 'Across the listed days'} hint={aggregated ? 'Average of combined daily FPPS hashrates across the main account and all subaccounts.' : GENERATED_AVG_HASHRATE_HINT}>
        <Reading value={formatAxisValue(averageHashrate, scale.divisor)} unit={scale.unit} unitSize="lg" />
      </StatCard>

      <StatCard variant="generated"
        title="Highest earning day"
        caption={highestDay ? `${formatGeneratedDate(highestDay.entry_day)}${aggregated ? ' · all accounts' : ''}` : 'No earnings recorded yet'}
      >
        {highestDay ? (
          <Reading value={formatBtc(highestDay.fpps_btc_generated)} unit="BTC" unitSize="lg" />
        ) : (
          <Reading value="--" />
        )}
      </StatCard>
      <StatCard variant="generated" title="Total days" caption={aggregated ? 'Distinct days across all accounts' : 'Distinct days with recorded earnings'}>
        <Reading value={totalDays.toLocaleString()} unit={totalDays === 1 ? 'day' : 'days'} unitSize="lg" />
      </StatCard>
    </div>
  );
}

/** Signed-in adapter; public watcher routes mount GeneratedBtcContent instead. */
export function GeneratedBtcPage() {
  const { aggregated } = useAggregatedModeContext();
  const accountId = useActiveAccountId();
  const progressPayouts = usePayouts(!aggregated);
  const single = useGeneratedBtc(!aggregated);
  // Aggregated mode reads generated-BTC entries across every account, tagged with
  // their owner; the two queries have separate cache entries so toggling never serves
  // the wrong set (same pattern as Payouts/Workers).
  const agg = useAggregatedGeneratedBtc(aggregated);
  const selectedQuery = aggregated ? agg : single;
  const { data } = selectedQuery;
  const entries = useMemo(() => data ?? [], [data]);

  // The Account facet (aggregated mode only) offers the main account plus every
  // subaccount; an empty selection keeps them all. These names must match the row tags
  // from useAggregatedGeneratedBtc exactly, so both derive from the same shared list.
  const { data: subs } = useSubaccountList();
  const accountNames = useMemo(
    () => (aggregated ? [MAIN_ACCOUNT_LABEL, ...(subs ?? []).map(subaccountName)] : undefined),
    [aggregated, subs],
  );

  return <GeneratedBtcContent key={`${accountId}-${aggregated}`} entries={entries} isLoading={selectedQuery.isLoading} isError={selectedQuery.isError} onRetry={selectedQuery.refetch} accounts={accountNames} canConnect canExport
    payoutProgress={aggregated ? undefined : { payouts: progressPayouts.data, isLoading: progressPayouts.isLoading, isError: progressPayouts.isError }} />;
}

export interface PayoutProgressData {
  payouts: Payout[] | undefined;
  isLoading: boolean;
  isError: boolean;
}

export function PayoutProgressCard({ entries, data, isLoading, isError }: {
  entries: GeneratedBtcEntry[];
  data: PayoutProgressData;
  isLoading: boolean;
  isError: boolean;
}) {
  const loading = isLoading || data.isLoading;
  const known = !loading && !isError && !data.isError && data.payouts !== undefined;
  const progress = known ? calculatePayoutProgress(entries, data.payouts!) : null;
  return (
    <section aria-label="Payout progress" aria-busy={loading} className="flex flex-col gap-3 border-y border-border py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-foreground">Next payout</span>
          <InfoHint text="Payouts are made daily at 07:00 AM CET." />
        </div>
        <p className="text-xs text-body-alt pt-1">{progress
          ? progress.remainingSats === 0 ? 'Minimum payout threshold reached.' : `${formatBtcFromSats(progress.remainingSats)} BTC more needed before next payout.`
          : loading ? 'Loading payout progress…' : 'Payout progress unavailable.'}</p>
      </div>
      <div className="ml-auto w-full max-w-72 space-y-1.5 text-right sm:shrink-0">
        <p className="text-xs tabular-nums text-body-alt">{progress ? formatBtcFromSats(progress.balanceSats) : '--'} / {formatBtcFromSats(MINIMUM_PAYOUT_SATS)} BTC</p>
        {progress && <div
          role="progressbar"
          aria-label="Progress toward minimum payout"
          aria-valuemin={0}
          aria-valuemax={MINIMUM_PAYOUT_SATS}
          aria-valuenow={Math.min(progress.balanceSats, MINIMUM_PAYOUT_SATS)}
          aria-valuetext={`${formatBtcFromSats(progress.balanceSats)} of ${formatBtcFromSats(MINIMUM_PAYOUT_SATS)} BTC`}
          className="h-1 overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full rounded-full bg-info transition-all" style={{ width: `${progress.percent}%` }} />
        </div>}
      </div>
    </section>
  );
}
