import { hasPayablePplnsWork } from '@/lib/pplnsProjection';
import type { PplnsProjection, PplnsProjectionHorizon } from '@/api/types';

function roundTo(digits: number, value: number): string {
  const factor = Math.pow(10, digits);
  return String(Math.round(value * factor) / factor);
}

function formatDifficulty(d: number): string {
  if (d >= 1e18) return `${roundTo(3, d / 1e18)} E`;
  if (d >= 1e15) return `${roundTo(3, d / 1e15)} P`;
  if (d >= 1e12) return `${roundTo(3, d / 1e12)} T`;
  if (d >= 1e9)  return `${roundTo(3, d / 1e9)} G`;
  if (d >= 1e6)  return `${roundTo(3, d / 1e6)} M`;
  if (d >= 1e3)  return `${roundTo(3, d / 1e3)} k`;
  return roundTo(3, d);
}

function formatBtcFromSats(sats: number): string {
  return `${(sats / 1e8).toFixed(8)} BTC`;
}

function formatTimestamp(iso: string): string {
  if (!iso) return '—';
  const date = iso.slice(0, 10);
  const time = iso.slice(11, 16);
  return time ? `${date} ${time} UTC` : date;
}

function formatShare(score: number): string {
  const pct = score * 100;
  if (pct > 0 && pct < 0.0001) return '<0.0001%';
  return `${roundTo(4, pct)}%`;
}

function formatFee(poolFee: number, brokerFee: number): string {
  return `${roundTo(2, Math.min(100, poolFee + brokerFee))}%`;
}

function horizonLabel(horizon: number): string {
  return horizon === 0 ? 'At snapshot' : `+${horizon} D of pool work`;
}


function StateMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}

function MetadataGrid({ projection }: { projection: PplnsProjection }) {
  const items: [string, string][] = [
    ['Data cutoff',                    formatTimestamp(projection.source_snapshot_at)],
    ['Calculated',                     formatTimestamp(projection.calculated_at)],
    ['Model',                          `v${projection.model_version}`],
    ['Snapshot height',                `#${projection.source_block_height}`],
    ['Latest PPLNS boundary',          `#${projection.last_pool_block_height}`],
    ['Network difficulty',             formatDifficulty(projection.network_difficulty)],
    ['Pool work since PPLNS boundary', formatDifficulty(projection.pool_work_since_last_block)],
    ['Anonymous current-round fill',   formatDifficulty(projection.synthetic_fill_difficulty)],
    ['Fixed block subsidy',            formatBtcFromSats(projection.block_subsidy_sats)],
  ];

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-3 border-y border-border py-4 sm:grid-cols-3 xl:grid-cols-5">
      {items.map(([label, value]) => (
        <div key={label} className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {label}
          </span>
          <span className="font-mono text-xs text-foreground break-words">{value}</span>
        </div>
      ))}
    </div>
  );
}

function ProjectionTable({ horizons }: { horizons: PplnsProjectionHorizon[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {['Scenario', 'Reward share', 'Gross subsidy', 'Applied fee', 'Net subsidy'].map(
              (h, i) => (
                <th
                  key={h}
                  className={`py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground ${i === 0 ? 'pr-4 text-left' : 'pl-4 text-right'}`}
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {horizons.map((h) => {
            const isSnap = h.horizon === 0;
            return (
              <tr
                key={h.horizon}
                className={`border-b border-border ${isSnap ? 'bg-muted' : ''}`}
              >
                <td
                  className={`py-2 pr-4 font-mono text-xs whitespace-nowrap ${isSnap ? 'font-semibold text-foreground' : 'text-foreground'}`}
                >
                  {horizonLabel(h.horizon)}
                </td>
                <td className="py-2 pl-4 text-right font-mono text-xs text-foreground whitespace-nowrap">
                  {formatShare(h.difficulty_score)}
                </td>
                <td className="py-2 pl-4 text-right font-mono text-xs text-foreground whitespace-nowrap">
                  {formatBtcFromSats(h.gross_subsidy_sats)}
                </td>
                <td className="py-2 pl-4 text-right font-mono text-xs text-foreground whitespace-nowrap">
                  {formatFee(h.pool_fee, h.broker_fee)}
                </td>
                <td
                  className={`py-2 pl-4 text-right font-mono text-xs font-semibold whitespace-nowrap ${isSnap ? 'text-green-500' : 'text-foreground'}`}
                >
                  {formatBtcFromSats(h.net_sats)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ProjectionBody({ projection }: { projection: PplnsProjection }) {
  return (
    <div className="space-y-4">
      <MetadataGrid projection={projection} />
      {hasPayablePplnsWork(projection) ? (
        <ProjectionTable horizons={projection.horizons} />
      ) : (
        <StateMessage
          title="No retained PPLNS work"
          body="This account has no accepted work remaining in the modeled PPLNS payout window."
        />
      )}
    </div>
  );
}

export function PplnsProjectionPanel({
  projection,
  isLoading,
  isError,
}: {
  /** `null` means the cache holds no projection for the latest boundary yet. */
  projection: PplnsProjection | null | undefined;
  isLoading: boolean;
  isError: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      {isLoading ? (
        <div className="h-48 animate-pulse rounded-lg bg-muted" />
      ) : isError ? (
        <StateMessage
          title="Projection could not be loaded"
          body="The dashboard could not load the latest PPLNS projection. Try again shortly."
        />
      ) : projection === null ? (
        <StateMessage
          title="Projection temporarily unavailable"
          body="No model-v2 projection is available for the latest PPLNS boundary yet. The cache may still be refreshing; try again shortly."
        />
      ) : projection !== undefined ? (
        <ProjectionBody projection={projection} />
      ) : null}
    </div>
  );
}
