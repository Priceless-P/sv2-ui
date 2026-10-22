import { downloadCsv as downloadCsvFile } from '@/lib/csvDownload';
import { PayoutsEmptyState } from '@/components/payouts/PayoutsEmptyState';
import { PayoutStatCards } from '@/components/payouts/PayoutStatCards';
import { PayoutsExportModal } from '@/components/payouts/PayoutsExportModal';
import { EMPTY_PAYOUT_FILTER_DRAFT, isPayoutDraftActive, PayoutsFilter, type PayoutFilterDraft } from '@/components/payouts/PayoutsFilter';
import { PayoutsTable } from '@/components/payouts/PayoutsTable';
import { TableToolbar } from '@/components/ui/TableToolbar';
import { useToastControls } from '@/components/ui/toast';
import { WorkersPagination } from '@/components/workers/WorkersPagination';
import {
  filterPayouts,
  filterPayoutsByAccount,
  payoutsInRange,
  payoutsToCsv,
  searchPayouts,
  sinceForPreset,
  sortPayoutsByAmount,
  type DateRange,
  type Payout,
} from '@/lib/payoutsTable';
import { paginate } from '@/lib/workersTable';
import { useMemo, useState } from 'react';
import { LiExport } from 'solar-icon-react/li';
import { useAggregatedModeContext } from '@/hooks/AggregatedModeProvider';
import { useAggregatedPayouts, usePayouts } from '@/hooks/usePayouts';
import { useSubaccountList } from '@/hooks/useSubaccounts';
import { MAIN_ACCOUNT_LABEL } from '@/lib/payoutsTable';
import { subaccountName } from '@/lib/subaccountsTable';

const PAGE_SIZE = 10;

function downloadCsv(content: string): void {
  downloadCsvFile(content, 'payouts.csv');
}

/** The Payouts page: on-chain payout history with search, filter, pagination, and CSV export. */
export function PayoutsContent({ payouts, isLoading, isError, onRetry: refetch, accounts: accountNames, canExport = false }: {
  payouts: Payout[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => unknown;
  accounts?: string[];
  canExport?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PayoutFilterDraft>(EMPTY_PAYOUT_FILTER_DRAFT);
  const [page, setPage] = useState(1);
  const [exportOpen, setExportOpen] = useState(false);
  const { toast, dismiss } = useToastControls();

  const now = Date.now();
  // The list arrives newest-first from the hook; search narrows by txid, then the
  // Filter applies the date preset (a since-cutoff) and mode, and the Amount option
  // re-sorts by size (otherwise the default newest-first order stands).
  const visible = useMemo(() => {
    const sinceSec = filter.datePreset ? sinceForPreset(filter.datePreset, now) : null;
    const rows = filterPayouts(searchPayouts(payouts, query), { modes: filter.modes, sinceSec });
    const scoped = filterPayoutsByAccount(rows, filter.accounts);
    return filter.amountSort ? sortPayoutsByAmount(scoped, filter.amountSort) : scoped;
  }, [payouts, query, filter, now]);
  const pageData = paginate(visible, page, PAGE_SIZE);

  // Export the chosen date range (independent of the table's search/filter) as CSV.
  // The CSV build is synchronous, so yield a frame first, otherwise React batches the
  // preparing and outcome toasts into one tick and the preparing toast never paints.
  const runExport = async (range: DateRange) => {
    setExportOpen(false);
    const pending = toast({ type: 'info', message: 'Preparing export...', description: 'Generating your CSV file.' });
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      const rows = payoutsInRange(payouts, range.startSec, range.endSec);
      downloadCsv(payoutsToCsv(rows));
      dismiss(pending);
      toast({ type: 'success', message: 'Export complete', description: 'Payouts data has been exported as CSV.' });
    } catch {
      dismiss(pending);
      toast({ type: 'error', message: 'Export failed', description: "We couldn't generate your CSV file. Please try again." });
    }
  };

  // Any change to search or filter can shrink the result set, so jump back to page 1.
  const changeQuery = (next: string) => {
    setQuery(next);
    setPage(1);
  };
  const applyFilter = (next: PayoutFilterDraft) => {
    setFilter(next);
    setPage(1);
  };
  const resetFilter = () => {
    setFilter(EMPTY_PAYOUT_FILTER_DRAFT);
    setPage(1);
  };

  const hasData = !isLoading && !isError && payouts.length > 0;
  const filterActive = isPayoutDraftActive(filter);
  const hasQuery = query.trim().length > 0;
  const tableEmpty =
    visible.length > 0
      ? undefined
      : filterActive
        ? { title: 'No payouts match this filter', hint: 'Adjust or clear your filters.', clearLabel: 'Clear filters', onClear: resetFilter }
        : hasQuery
          ? {
            title: 'No payouts found',
            hint: 'Try a different transaction ID or clear your search.',
            clearLabel: 'Clear search',
            onClear: () => changeQuery(''),
          }
          : undefined;

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl font-semibold leading-9 tracking-[-1px] text-heading">Payouts</h2>
          <p className="mt-1 text-sm text-body-alt">View your payout history and on-chain transactions.</p>
        </div>
        {canExport && hasData && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setExportOpen((o) => !o)}
              aria-expanded={exportOpen}
              aria-haspopup="dialog"
              className="inline-flex h-9 items-center gap-2 rounded-[32px] border border-black/20 bg-info px-5 text-sm leading-5 text-info-foreground transition-opacity hover:opacity-90"
            >
              <LiExport className="h-3.5 w-3.5" /> Export CSV
            </button>
            {exportOpen && <PayoutsExportModal onCancel={() => setExportOpen(false)} onExport={runExport} />}
          </div>
        )}
      </header>

      <PayoutStatCards payouts={payouts} isLoading={isLoading} isError={isError} aggregated={accountNames !== undefined} />

      {isLoading ? (
        <div className="h-80 animate-pulse rounded-xl border border-border bg-muted" />
      ) : isError ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-base font-semibold text-foreground">Couldn't load payouts</p>
          <p className="mt-1 text-sm text-body-alt">Something went wrong reading your on-chain payout history.</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-4 inline-flex items-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Try again
          </button>
        </div>
      ) : payouts.length === 0 ? (
        <div className="border-t border-border">
          <PayoutsEmptyState />
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <TableToolbar
            title="Payouts"
            query={query}
            onQuery={changeQuery}
            searchPlaceholder="Search transaction ID"
            searchLabel="Search payouts by transaction ID"
            filterActive={filterActive}
            renderFilter={(onClose) => <PayoutsFilter
              applied={filter}
              onApply={applyFilter}
              onReset={resetFilter}
              onClose={onClose}
              accounts={accountNames}
            />}
          />
          <PayoutsTable
            payouts={pageData.items}
            empty={tableEmpty}
            showAccount={accountNames !== undefined}
          />
          {visible.length > 0 && (
            <WorkersPagination page={pageData.page} totalPages={pageData.totalPages} onPage={setPage} />
          )}
        </div>
      )}
    </div>
  );
}

/** Signed-in adapter; public watcher routes mount PayoutsContent instead. */
export function PayoutsPage() {
  const { aggregated } = useAggregatedModeContext();
  const single = usePayouts(!aggregated);
  // Aggregated mode reads payouts across every account, tagged with their owner; the
  // two queries have separate cache entries so toggling never serves the wrong set.
  const agg = useAggregatedPayouts(aggregated);
  const { data, isLoading, isError, refetch } = aggregated ? agg : single;
  const payouts = useMemo(() => data ?? [], [data]);

  // The Account facet (aggregated mode only) offers the main account plus every
  // subaccount; an empty selection keeps them all. These names must match the row
  // tags from useAggregatedPayouts exactly, so both derive from the same shared list.
  const { data: subs } = useSubaccountList();
  const accountNames = useMemo(
    () => (aggregated ? [MAIN_ACCOUNT_LABEL, ...(subs ?? []).map(subaccountName)] : undefined),
    [aggregated, subs],
  );

  return <PayoutsContent payouts={payouts} isLoading={isLoading} isError={isError} onRetry={refetch} accounts={accountNames} canExport />;
}
