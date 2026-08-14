import type { HashratePoint } from '@/api/types';

/**
 * Combine several accounts' series into one by adding the readings that share a
 * timestamp (the pool samples every account on the same schedule, so timestamps line
 * up). A timestamp only some accounts reported is kept with the readings that exist,
 * which is the honest total for that moment rather than dropping a real sample. The
 * result is ordered oldest first so the chart draws left to right.
 */
export function sumHashrateSeries(series: HashratePoint[][]): HashratePoint[] {
  const byTimestamp = new Map<string, HashratePoint>();
  for (const points of series) {
    for (const p of points) {
      const existing = byTimestamp.get(p.observed_at);
      if (existing) {
        existing.pplns_hashrate += p.pplns_hashrate;
        existing.fpps_hashrate += p.fpps_hashrate;
        existing.total_hashrate += p.total_hashrate;
      } else {
        byTimestamp.set(p.observed_at, {
          observed_at: p.observed_at,
          pplns_hashrate: p.pplns_hashrate,
          fpps_hashrate: p.fpps_hashrate,
          total_hashrate: p.total_hashrate,
        });
      }
    }
  }
  return [...byTimestamp.values()].sort((a, b) => a.observed_at.localeCompare(b.observed_at));
}
