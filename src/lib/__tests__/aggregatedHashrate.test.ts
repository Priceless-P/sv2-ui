import test from 'node:test';
import assert from 'node:assert/strict';
import type { HashratePoint } from '@/api/types';
import { sumHashrateSeries } from '@/lib/aggregatedHashrate';

function point(over: Partial<HashratePoint> = {}): HashratePoint {
  return { observed_at: '2026-07-24T00:00:00Z', pplns_hashrate: 0, fpps_hashrate: 0, total_hashrate: 0, ...over };
}

test('sumHashrateSeries adds every account reading at the same timestamp', () => {
  const main = [point({ observed_at: 't1', pplns_hashrate: 10, fpps_hashrate: 1, total_hashrate: 11 })];
  const sub = [point({ observed_at: 't1', pplns_hashrate: 20, fpps_hashrate: 2, total_hashrate: 22 })];
  assert.deepEqual(sumHashrateSeries([main, sub]), [
    { observed_at: 't1', pplns_hashrate: 30, fpps_hashrate: 3, total_hashrate: 33 },
  ]);
});

test('sumHashrateSeries keeps a timestamp only some accounts reported, and orders by time', () => {
  const main = [point({ observed_at: '2026-07-24T00:02:00Z', total_hashrate: 5 })];
  const sub = [point({ observed_at: '2026-07-24T00:00:00Z', total_hashrate: 7 })];
  const merged = sumHashrateSeries([main, sub]);
  assert.deepEqual(
    merged.map((p) => p.observed_at),
    ['2026-07-24T00:00:00Z', '2026-07-24T00:02:00Z'],
  );
  // A sample no other account reported still carries that account's real reading.
  assert.equal(merged[0].total_hashrate, 7);
  assert.equal(merged[1].total_hashrate, 5);
});

test('sumHashrateSeries handles no accounts and empty series', () => {
  assert.deepEqual(sumHashrateSeries([]), []);
  assert.deepEqual(sumHashrateSeries([[], []]), []);
});
