import type { GeneratedBtcEntry } from '@/api/types';
import { InfoHint } from '@/components/ui/InfoHint';
import { MINIMUM_PAYOUT_SATS, payoutProgress } from '@/lib/generatedBtcTable';
import { formatBtcFromSats, type Payout } from '@/lib/payoutsTable';

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
  const progress = known ? payoutProgress(entries, data.payouts!) : null;
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
