import { combinedDailyEarnings, hasFppsActivity } from '@/lib/generatedBtcTable';
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
import { Reading } from '@/components/ui/Reading';
import { StatCard } from '@/components/ui/StatCard';
import { TableToolbar } from '@/components/ui/TableToolbar';
import { WorkersPagination } from '@/components/workers/WorkersPagination';
import { formatAxisValue, pickHashrateScale } from '@/lib/chartAxis';
import {
  averageEntryHashrate,
  filterGeneratedBtc,
  filterGeneratedBtcByAccount,
  formatBtc,
  formatGeneratedDate,
  generatedBtcToCsv,
  highestEarningDay,
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

const PAGE_SIZE = 10;

function downloadCsv(content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'generated_btc.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * The Generated BTC page: the account's daily FPPS hashrate and generated BTC with
 * summary cards, a date filter, pagination, and CSV export.
 */
export function GeneratedBtcContent({ entries: allEntries, isLoading, isError, onRetry: refetch, accounts: accountNames, canConnect = false, canExport = false }: {
  entries: GeneratedBtcEntry[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => unknown;
  accounts?: string[];
  canConnect?: boolean;
  canExport?: boolean;
}) {
  const entries = useMemo(() => allEntries.filter(hasFppsActivity), [allEntries]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<GbtcFilterDraft>(EMPTY_GBTC_FILTER_DRAFT);
  const [page, setPage] = useState(1);

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

  const aggregated = accountNames !== undefined;
  const totals = useMemo(() => {
    const dailyEntries = aggregated ? combinedDailyEarnings(entries) : entries;
    return { generated: sumGenerated(entries), averageHashrate: averageEntryHashrate(dailyEntries), highestDay: highestEarningDay(dailyEntries) };
  }, [entries, aggregated]);

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
            onClick={() => downloadCsv(generatedBtcToCsv(visible))}
            className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--btn))] px-5 py-2 text-sm font-medium text-[hsl(var(--btn-foreground))] transition-opacity hover:opacity-90"
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
        <div className="border-t border-border">
          <GeneratedBtcEmptyState canConnect={canConnect} />
        </div>
      ) : (
        <>
          <GeneratedBtcStatCards
            generated={totals.generated}
            averageHashrate={totals.averageHashrate}
            highestDay={totals.highestDay}
          />
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
            <GeneratedBtcTable
              entries={pageData.items}
              empty={tableEmpty}
              showAccount={accountNames !== undefined}
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

/** FPPS generated BTC / average FPPS hashrate / highest FPPS earning day. */
function GeneratedBtcStatCards({
  generated,
  averageHashrate,
  highestDay,
}: {
  generated: number;
  averageHashrate: number;
  highestDay: GeneratedBtcEntry | null;
}) {
  // One unit for the hashrate figure, matching how every other hashrate reading is set.
  const scale = pickHashrateScale([averageHashrate]);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard variant="generated" title="Generated BTC" caption="Generated under FPPS across the listed days">
        <Reading value={formatBtc(generated)} unit="BTC" unitSize="lg" />
      </StatCard>

      <StatCard variant="generated" title="Average FPPS hashrate" caption="Across the listed days" hint={GENERATED_AVG_HASHRATE_HINT}>
        <Reading value={formatAxisValue(averageHashrate, scale.divisor)} unit={scale.unit} unitSize="lg" />
      </StatCard>

      <StatCard variant="generated"
        title="Highest earning day"
        caption={highestDay ? formatGeneratedDate(highestDay.entry_day) : 'No earnings recorded yet'}
      >
        {highestDay ? (
          <Reading value={formatBtc(highestDay.fpps_btc_generated)} unit="BTC" unitSize="lg" />
        ) : (
          <Reading value="--" />
        )}
      </StatCard>
    </div>
  );
}

/** Signed-in adapter; public watcher routes mount GeneratedBtcContent instead. */
export function GeneratedBtcPage() {
  const { aggregated } = useAggregatedModeContext();
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

  return <GeneratedBtcContent entries={entries} isLoading={selectedQuery.isLoading} isError={selectedQuery.isError} onRetry={selectedQuery.refetch} accounts={accountNames} canConnect canExport />;
}
