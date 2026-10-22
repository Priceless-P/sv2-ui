import test from 'node:test';
import assert from 'node:assert/strict';
import {
  combinePplnsDailyWork,
  derivePplnsProjectionStats,
  filterPplnsDailyWork,
  formatPplnsWorkDay,
  hasPayablePplnsWork,
  searchPplnsDailyWork,
  totalDailyWorkNetSats,
  pplnsDailyWorkToCsv,
} from '../pplnsProjection';

test('PPLNS CSV exports only supplied work days with raw rate and satoshi amounts', () => {
  const csv = pplnsDailyWorkToCsv([day({ work_day: '2026-10-21', retained_difficulty: 86400 / 2 ** 32, total_net_sats: 123 })]);
  const lines = csv.split('\n');
  assert.equal(lines.length, 2);
  const cells = lines[1].split(',');
  assert.equal(cells[0], '2026-10-21');
  assert.equal(cells[2], '1');
  assert.equal(cells[5], '123');
});
import type { PplnsProjectionDailyWork } from '@/api/types';
import { pplnsProjectionFixture } from '@/api/__tests__/pplnsProjectionFixture';

const day = (over: Partial<PplnsProjectionDailyWork> = {}): PplnsProjectionDailyWork => ({
  work_day: '2026-08-31',
  retained_difficulty: 1,
  projected_net_sats: 999,
  already_earned_net_sats: 1,
  total_net_sats: 100,
  earned_history_complete: true,
  ...over,
});

test('the grand total sums every retained day', () => {
  assert.equal(totalDailyWorkNetSats([day({ total_net_sats: 100 }), day({ total_net_sats: 250 })]), 350);
});

test('the grand total of no retained work is zero', () => {
  assert.equal(totalDailyWorkNetSats([]), 0);
});

test('daily work search matches raw and displayed row values', () => {
  const rows = [
    day({ work_day: '2026-08-31', retained_difficulty: 1, total_net_sats: 1000 }),
    day({ work_day: '2026-09-01', retained_difficulty: 2, total_net_sats: 2500 }),
  ];

  assert.deepEqual(searchPplnsDailyWork(rows, 'monday 31 august'), [rows[0]]);
  assert.deepEqual(searchPplnsDailyWork(rows, '2026-09-01'), [rows[1]]);
  assert.deepEqual(searchPplnsDailyWork(rows, '0.00001'), [rows[0]]);
  assert.equal(searchPplnsDailyWork(rows, 'no match').length, 0);
  assert.equal(searchPplnsDailyWork(rows, '  ').length, 2);
});

test('daily work date filtering uses inclusive UTC bounds', () => {
  const rows = [
    day({ work_day: '2026-08-30' }),
    day({ work_day: '2026-08-31' }),
    day({ work_day: '2026-09-01' }),
  ];

  assert.deepEqual(
    filterPplnsDailyWork(rows, {
      sinceMs: Date.parse('2026-08-31T00:00:00Z'),
      untilMs: Date.parse('2026-09-01T23:59:59Z'),
    }),
    [rows[1], rows[2]],
  );
  assert.equal(filterPplnsDailyWork(rows, { sinceMs: null, untilMs: null }), rows);
});

test('work days are formatted in canonical UTC form', () => {
  assert.equal(formatPplnsWorkDay('2026-08-31'), 'Monday 31 August 2026');
  assert.equal(formatPplnsWorkDay('not-a-day'), 'not-a-day');
});

test('positive retained work at horizon zero makes the account payable', () => {
  const projection = pplnsProjectionFixture();
  projection.horizons[0].retained_difficulty = 5;
  assert.ok(hasPayablePplnsWork(projection));
});

test('visibility follows horizon zero rather than the daily rows', () => {
  const projection = pplnsProjectionFixture();
  projection.horizons[0].retained_difficulty = 0;
  projection.daily_work[0].retained_difficulty = 5;
  assert.equal(hasPayablePplnsWork(projection), false);
  assert.equal(hasPayablePplnsWork(null), false);
  assert.equal(hasPayablePplnsWork(undefined), false);
});

test('combined PPLNS work sums earned and projected sats and keeps one row per UTC day', () => {
  const base = pplnsProjectionFixture().daily_work[0];
  const rows = combinePplnsDailyWork([
    [{ ...base, work_day: '2026-10-20', retained_difficulty: 10, projected_net_sats: 100, already_earned_net_sats: 20, total_net_sats: 120 }],
    [{ ...base, work_day: '2026-10-20', retained_difficulty: 30, projected_net_sats: 300, already_earned_net_sats: 60, total_net_sats: 360, earned_history_complete: false },
      { ...base, work_day: '2026-10-21', retained_difficulty: 20, projected_net_sats: 200, already_earned_net_sats: 0, total_net_sats: 200 }],
  ]);
  assert.equal(rows.length, 2);
  const firstDay = rows.find((day) => day.work_day === '2026-10-20')!;
  assert.equal(firstDay.total_net_sats, 480);
  assert.equal(firstDay.retained_difficulty, 40);
  assert.equal(firstDay.already_earned_net_sats, 80);
  assert.equal(firstDay.earned_history_complete, false);
  assert.deepEqual(derivePplnsProjectionStats(rows), { totalNetSats: 680, projectedNetSats: 600, retainedDifficulty: 60, workDays: 2 });
});
