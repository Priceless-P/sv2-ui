import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { HashratePoint, HashrateRange } from '@/api/types';

const RANGE_MS: Record<HashrateRange, number> = {
  '1H': 60 * 60 * 1000,
  '6H': 6 * 60 * 60 * 1000,
  '24H': 24 * 60 * 60 * 1000,
  '7D': 7 * 24 * 60 * 60 * 1000,
};

const DAY_MS = 24 * 60 * 60 * 1000;
const COMPARISON_TOLERANCE_MS = 5 * 60 * 1000;
const MAX_CURRENT_SNAPSHOT_AGE_MS = 10 * 60 * 1000;

/**
 * Maps a chart range to the RFC3339 `{from,to}` window the historical endpoint
 * expects (`/api/v1/user/hashrate/historical?from=&to=`). `to` is now; `from` is the
 * range earlier.
 */
export function rangeToWindow(range: HashrateRange, nowMs: number): { from: string; to: string } {
  return {
    from: new Date(nowMs - RANGE_MS[range]).toISOString(),
    to: new Date(nowMs).toISOString(),
  };
}

function validCurrentSnapshotTime(observedAt: string | null | undefined, nowMs: number): number | null {
  if (!observedAt || !Number.isFinite(nowMs)) return null;
  const timestamp = Date.parse(observedAt);
  if (!Number.isFinite(timestamp)) return null;

  const age = nowMs - timestamp;
  if (age < -COMPARISON_TOLERANCE_MS || age > MAX_CURRENT_SNAPSHOT_AGE_MS) return null;
  return timestamp;
}

/** Narrow raw-history window around the point exactly 24 hours before a fresh snapshot. */
export function hashrateComparisonWindow(
  observedAt: string | null | undefined,
  nowMs: number,
): { from: string; to: string } | null {
  const currentAt = validCurrentSnapshotTime(observedAt, nowMs);
  if (currentAt === null) return null;

  const target = currentAt - DAY_MS;
  return {
    from: new Date(target - COMPARISON_TOLERANCE_MS).toISOString(),
    to: new Date(target + COMPARISON_TOLERANCE_MS).toISOString(),
  };
}

/** Percentage change between comparable 10-minute snapshots separated by 24 hours. */
export function hashrateChangeFrom24HoursAgo(
  current: number,
  currentObservedAt: string | null | undefined,
  points: HashratePoint[],
  nowMs: number,
): number | null {
  if (!Number.isFinite(current)) return null;
  const currentAt = validCurrentSnapshotTime(currentObservedAt, nowMs);
  if (currentAt === null) return null;

  const target = currentAt - DAY_MS;
  let baseline: { distance: number; hashrate: number } | null = null;
  for (const point of points) {
    const timestamp = Date.parse(point.observed_at);
    if (!Number.isFinite(timestamp) || !Number.isFinite(point.total_hashrate)) continue;
    const distance = Math.abs(timestamp - target);
    if (baseline === null || distance < baseline.distance) {
      baseline = { distance, hashrate: point.total_hashrate };
    }
  }


  if (baseline === null || baseline.distance > COMPARISON_TOLERANCE_MS || baseline.hashrate <= 0) return null;
  return ((current - baseline.hashrate) / baseline.hashrate) * 100;
}

/**
 * The historical endpoint returns dense samples (~one every two minutes, so a week
 * is ~5000 points). Recharts is SVG-backed and degrades past ~1000 points per
 * series, so bucket the points into at most `maxPoints` groups and average each
 * bucket. Averaging rather than sampling keeps the trend honest when a bucket
 * spans several samples. The newest point anchors to the latest sample so the line
 * still ends at "now".
 */
export function downsampleHashrate(points: HashratePoint[], maxPoints: number): HashratePoint[] {
  if (maxPoints <= 0) return [];
  if (points.length <= maxPoints) return points;

  const bucketSize = Math.ceil(points.length / maxPoints);
  const out: HashratePoint[] = [];
  for (let i = 0; i < points.length; i += bucketSize) {
    const bucket = points.slice(i, i + bucketSize);
    let pplns = 0;
    let fpps = 0;
    let total = 0;
    for (const p of bucket) {
      pplns += p.pplns_hashrate;
      fpps += p.fpps_hashrate;
      total += p.total_hashrate;
    }
    const n = bucket.length;
    out.push({
      observed_at: bucket[n - 1].observed_at,
      pplns_hashrate: pplns / n,
      fpps_hashrate: fpps / n,
      total_hashrate: total / n,
    });
  }
  // The current reading must match the live snapshot, even when the older trend
  // needs averaging. Retain its rates as well as its timestamp.
  out[out.length - 1] = { ...points[points.length - 1] };
  return out;
}

export interface HistoryWindow {
  from: number;
  to: number;
  points: HashratePoint[];
}

export function cachedHashrateHistory(
  cache: QueryClient, key: QueryKey, window: { from: string; to: string },
  read: (from: string, to: string, signal: AbortSignal) => Promise<HashratePoint[]>, fixed = false,
) {
  return cache.fetchQuery({
    queryKey: key,
    queryFn: ({ signal }) => refreshHashrateHistory(cache.getQueryData<HistoryWindow>(key), window, (from, to) => read(from, to, signal)),
    staleTime: fixed ? Infinity : 0,
    // Imperative reads have no observer. Retain samples beyond the polling period.
    gcTime: 30 * 60 * 1000,
    retry: false,
  }).then((result) => result.points);
}

/** Keep precise samples and re-read a small overlap to catch the two-minute snapshot boundary. */
export async function refreshHashrateHistory(
  previous: HistoryWindow | undefined,
  window: { from: string; to: string },
  read: (from: string, to: string) => Promise<HashratePoint[]>,
): Promise<HistoryWindow> {
  const from = Date.parse(window.from);
  const to = Date.parse(window.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) throw new Error('Invalid history window');
  const overlaps = previous && previous.from <= from && previous.to >= from && previous.to <= to;
  const start = overlaps ? Math.max(from, previous.to - 4 * 60 * 1000) : from;
  const incoming = await read(new Date(start).toISOString(), window.to);
  const points = new Map<number, HashratePoint>();
  for (const row of [...(overlaps ? previous.points : []), ...incoming]) {
    const timestamp = Date.parse(row.observed_at);
    if (timestamp >= from && timestamp <= to) points.set(timestamp, row);
  }
  return { from, to, points: [...points].sort(([a], [b]) => a - b).map(([, point]) => point) };
}
