import type { HashratePoint } from '@/api/types';
import type { QueryClient, QueryKey } from '@tanstack/react-query';

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
