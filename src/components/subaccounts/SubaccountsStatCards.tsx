import type { ReactNode } from 'react';
import { InfoHint } from '@/components/ui/InfoHint';
import { Reading } from '@/components/ui/Reading';
import { formatAxisValue, pickHashrateScale } from '@/lib/chartAxis';
import { formatBtc, type SubaccountsPageStats } from '@/lib/subaccountsTable';
import { SUBACCOUNTS_LIVE_HASHRATE_HINT } from '@/lib/metricWindows';

/**
 * A stat card. Same shell and type ramp as the home and workers cards, so the three
 * pages cannot drift apart: the reading is a numeral in the heading face with its unit
 * trailing at body size, and the caption sits at body size below it.
 */
function Card({
  title,
  hint,
  children,
  caption,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
  caption: string;
}) {
  return (
    <div className="flex flex-col justify-between gap-2 border-[0.5px] border-border bg-card p-4 lg:p-5">
      <div className="flex items-center gap-2">
        <span className="text-sm leading-5 text-body-alt">{title}</span>
        {hint && <InfoHint text={hint} />}
      </div>
      {children}
      <p className="text-sm leading-5 text-body-alt">{caption}</p>
    </div>
  );
}

/** Summary figures from the existing subaccount data. */
export function SubaccountsStatCards({ stats }: { stats: SubaccountsPageStats }) {
  // One unit for the combined figure, matching how every other hashrate reading is set.
  const scale = pickHashrateScale([stats.combinedHashrate]);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card title="Total subaccounts" caption="Mining operations">
        <Reading value={stats.total} />
      </Card>

      <Card title="Average hashrate" hint={SUBACCOUNTS_LIVE_HASHRATE_HINT} caption="Across all subaccounts">
        <Reading value={formatAxisValue(stats.combinedHashrate, scale.divisor)} unit={scale.unit} />
      </Card>

      <Card title="Average rejection rate" hint="Rejected shares divided by all submitted shares across subaccounts over the last 24 hours. Weighted by share volume." caption="Last 24 hours across all subaccounts">
        <Reading value={stats.averageRejectionRate === null ? '--' : (stats.averageRejectionRate * 100).toFixed(2)} unit={stats.averageRejectionRate === null ? undefined : '%'} />
      </Card>

      <Card title="Today's FPPS earnings" caption="Generated today (UTC) across subaccounts">
        <Reading value={formatBtc(stats.todayEarnings)} unit="BTC" />
      </Card>
    </div>
  );
}
