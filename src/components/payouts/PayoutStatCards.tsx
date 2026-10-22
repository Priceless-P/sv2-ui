import { useMemo } from 'react';
import { StatCard } from '@/components/ui/StatCard';
import { formatBtcFromSats, formatPayoutDate, summarizePayouts, type Payout } from '@/lib/payoutsTable';

/** The API defaults to 30 UTC calendar days; table filters do not change these totals. */
export function PayoutStatCards({ payouts, isLoading, isError, aggregated = false }: {
  payouts: Payout[];
  isLoading: boolean;
  isError: boolean;
  aggregated?: boolean;
}) {
  const summary = useMemo(() => summarizePayouts(payouts), [payouts]);
  const known = !isLoading && !isError;
  const latest = known ? summary.latest : null;

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Payout summary" aria-busy={isLoading}>
      <StatCard
        title="Total paid out"
        value={known ? formatBtcFromSats(summary.totalSats) : '--'}
        unit={known ? 'BTC' : undefined}
        caption={aggregated ? 'All accounts · last 30 days (UTC).' : 'Last 30 days (UTC).'}
        hint="Total confirmed bitcoin payouts over the last 30 calendar days for the accounts in this view. Table filters do not change this total."
      />
      <StatCard
        title="Total payout count"
        value={known ? summary.count.toLocaleString() : '--'}
        caption={aggregated ? 'Confirmed outputs across all accounts.' : 'Confirmed outputs over 30 days.'}
        hint="Counts each confirmed payout output over the last 30 calendar days (UTC), matching the rows in your payout history. One transaction can contain multiple payouts."
      />
      <StatCard
        title="Latest payout"
        value={latest ? formatBtcFromSats(latest.amountSats) : '--'}
        unit={latest ? 'BTC' : undefined}
        caption={aggregated ? 'Latest payout across all accounts.' : 'Most recent confirmed payout.'}
        hint={`${latest ? `Confirmed ${formatPayoutDate(latest.date)} (UTC). ` : ''}The most recently confirmed payout output in the last 30 calendar days (UTC) across the accounts in this view.`}
      />
    </div>
  );
}
