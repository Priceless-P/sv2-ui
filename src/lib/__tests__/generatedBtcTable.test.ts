import assert from 'node:assert/strict';
import test from 'node:test';

import type { GeneratedBtcEntry } from '@/api/types';
import {
  combinedDailyEarnings,
  averageEntryHashrate,
  sumGenerated,
  hasFppsActivity,
  sortGeneratedByDateDesc,
  formatGeneratedDate,
  entryDayMs,
  sinceMsForPreset,
  filterGeneratedBtc,
  isGeneratedBtcFilterActive,
  EMPTY_GENERATED_BTC_FILTER,
  formatBtc,
  todayGeneratedBtc,
  generatedBtcToCsv,
  dedupeGeneratedBtc,
  filterGeneratedBtcByAccount,
  highestEarningDay,
  searchGeneratedBtc,
  type GeneratedBtcFilter,
  generatedBtcRowId,
} from '@/lib/generatedBtcTable';
import { MAIN_ACCOUNT_LABEL } from '@/lib/payoutsTable';

function entry(over: Partial<GeneratedBtcEntry> = {}): GeneratedBtcEntry {
  return { entry_day: '2026-06-21', hashrate: 100e12, btc_generated: 0.0001, fpps_btc_generated: 0.0001, pplns_btc_generated: 0, pplns_hashrate: 0, ...over };
}

test('sumGenerated adds only FPPS-generated BTC; 0 when empty', () => {
  const entries = [
    entry({ fpps_btc_generated: 0.001, pplns_btc_generated: 9, btc_generated: 9.001 }),
    entry({ fpps_btc_generated: 0.0004, pplns_btc_generated: 8, btc_generated: 8.0004 }),
  ];
  assert.ok(Math.abs(sumGenerated(entries) - 0.0014) < 1e-12);
  assert.equal(sumGenerated([]), 0);
});

test('the FPPS view excludes PPLNS-only days while retaining FPPS work or earnings', () => {
  assert.equal(hasFppsActivity(entry({ hashrate: 0, fpps_btc_generated: 0, pplns_hashrate: 100e12, pplns_btc_generated: 1, btc_generated: 1 })), false);
  assert.equal(hasFppsActivity(entry({ hashrate: 0, fpps_btc_generated: 0, btc_generated: 0 })), false);
  assert.equal(hasFppsActivity(entry({ hashrate: 100e12, fpps_btc_generated: 0 })), true);
  assert.equal(hasFppsActivity(entry({ hashrate: 0, fpps_btc_generated: 0.001 })), true);
});

test('sortGeneratedByDateDesc orders newest entry_day first', () => {
  const out = sortGeneratedByDateDesc([entry({ entry_day: '2026-06-21' }), entry({ entry_day: '2026-07-08' })]);
  assert.deepEqual(out.map((e) => e.entry_day), ['2026-07-08', '2026-06-21']);
});

test('formatGeneratedDate renders the same long UTC date as PPLNS Projection', () => {
  assert.equal(formatGeneratedDate('2026-06-21'), 'Sunday 21 June 2026');
  assert.equal(formatGeneratedDate('2026-07-08'), 'Wednesday 8 July 2026');
});

test('entryDayMs is the UTC midnight ms of the day; NaN for an unparseable date', () => {
  assert.equal(entryDayMs(entry({ entry_day: '2026-06-21' })), Date.UTC(2026, 5, 21));
  assert.ok(Number.isNaN(entryDayMs(entry({ entry_day: 'not-a-date' }))));
});

test('sinceMsForPreset returns a UTC-midnight cutoff N-1 days before today', () => {
  const now = Date.UTC(2026, 6, 12, 15, 30); // 2026-07-12 15:30 UTC
  assert.equal(sinceMsForPreset('24h', now), Date.UTC(2026, 6, 12));
  assert.equal(sinceMsForPreset('7d', now), Date.UTC(2026, 6, 6));
  assert.equal(sinceMsForPreset('30d', now), Date.UTC(2026, 5, 13));
});

test('filterGeneratedBtc keeps entries within the since/until day bounds (inclusive); null bounds pass all', () => {
  const es = [entry({ entry_day: '2026-06-21' }), entry({ entry_day: '2026-07-08' })];
  assert.deepEqual(
    filterGeneratedBtc(es, { sinceMs: Date.UTC(2026, 6, 1), untilMs: null }).map((e) => e.entry_day),
    ['2026-07-08'],
  );
  assert.deepEqual(
    filterGeneratedBtc(es, { sinceMs: null, untilMs: Date.UTC(2026, 5, 30) }).map((e) => e.entry_day),
    ['2026-06-21'],
  );
  // inclusive on the exact end day
  assert.deepEqual(
    filterGeneratedBtc(es, { sinceMs: null, untilMs: Date.UTC(2026, 6, 8) }).map((e) => e.entry_day),
    ['2026-06-21', '2026-07-08'],
  );
  assert.equal(filterGeneratedBtc(es, EMPTY_GENERATED_BTC_FILTER).length, 2);
  // an unparseable date is excluded once any bound is set
  assert.equal(
    filterGeneratedBtc([entry({ entry_day: 'bad' })], { sinceMs: Date.UTC(2026, 0, 1), untilMs: null }).length,
    0,
  );
});

test('isGeneratedBtcFilterActive is true only when a bound is set', () => {
  assert.equal(isGeneratedBtcFilterActive(EMPTY_GENERATED_BTC_FILTER), false);
  assert.equal(isGeneratedBtcFilterActive({ sinceMs: 1, untilMs: null }), true);
  assert.equal(isGeneratedBtcFilterActive({ sinceMs: null, untilMs: 1 }), true);
});

test('todayGeneratedBtc picks the entry for the current UTC day', () => {
  const now = Date.parse('2026-07-24T09:30:00Z');
  const entries = [
    entry({ entry_day: '2026-07-24', fpps_btc_generated: 0.5, pplns_btc_generated: 7, btc_generated: 7.5 }),
    entry({ entry_day: '2026-07-23', fpps_btc_generated: 0.25, pplns_btc_generated: 6, btc_generated: 6.25 }),
  ];
  assert.equal(todayGeneratedBtc(entries, now), 0.5);
  // Late in the UTC day the answer must not slide onto the neighbouring day.
  assert.equal(todayGeneratedBtc(entries, Date.parse('2026-07-24T23:59:59Z')), 0.5);
  // No entry for today yet reads as nothing generated.
  assert.equal(todayGeneratedBtc([entry({ entry_day: '2026-07-20', fpps_btc_generated: 9 })], now), 0);
});

test('highestEarningDay compares FPPS earnings rather than the combined API total', () => {
  const fppsWinner = entry({ entry_day: '2026-07-24', fpps_btc_generated: 2, btc_generated: 2 });
  const pplnsHeavy = entry({ entry_day: '2026-07-23', fpps_btc_generated: 1, pplns_btc_generated: 99, btc_generated: 100 });
  assert.equal(highestEarningDay([pplnsHeavy, fppsWinner]), fppsWinner);
});

test('formatBtc shows the amount as the API sent it, never in exponent form', () => {
  assert.equal(formatBtc(0.0014), '0.0014');
  assert.equal(formatBtc(0.00001342), '0.00001342');
  assert.equal(formatBtc(0), '0');
  assert.equal(formatBtc(1), '1');
  assert.equal(formatBtc(0.0000005), '0.0000005');
  assert.equal(formatBtc(0.001 + 0.0004), '0.0014');
});

test('generatedBtcToCsv exports only FPPS fields, one row per entry, and guards formula injection', () => {
  const csv = generatedBtcToCsv([entry({ entry_day: '2026-06-21', hashrate: 102e12, fpps_btc_generated: 0.00001, pplns_btc_generated: 0.00000342, btc_generated: 0.00001342 })]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'entry_day,hashrate,fpps_btc_generated');
  assert.equal(lines.length, 2);
  assert.equal(lines[1], '2026-06-21,102000000000000,0.00001');
  // a leading '=' in a cell is neutralized
  const inj = generatedBtcToCsv([entry({ entry_day: '=SUM(A1)', hashrate: 1, btc_generated: 1 })]);
  assert.match(inj.split('\n')[1], /^'=SUM\(A1\)/);
});

test('dedupeGeneratedBtc keeps the first row per (entry_day, account); a single-owner fetch is untouched', () => {
  const rows = [
    entry({ entry_day: '2026-07-08', btc_generated: 0.001, account: MAIN_ACCOUNT_LABEL }),
    entry({ entry_day: '2026-07-08', btc_generated: 0.001, account: 'Client Alpha' }),
    // an exact duplicate (same day, same owner) — collapses to the first
    entry({ entry_day: '2026-07-08', btc_generated: 0.999, account: 'Client Alpha' }),
    entry({ entry_day: '2026-07-09', btc_generated: 0.002, account: 'Client Alpha' }),
  ];
  const out = dedupeGeneratedBtc(rows);
  assert.equal(out.length, 3);
  assert.equal(out.find((e) => e.entry_day === '2026-07-08' && e.account === 'Client Alpha')?.btc_generated, 0.001);
});

test('dedupeGeneratedBtc treats rows with no account as their own bucket', () => {
  const rows = [entry({ entry_day: '2026-07-08', account: undefined }), entry({ entry_day: '2026-07-08', account: undefined })];
  assert.equal(dedupeGeneratedBtc(rows).length, 1);
});

test('filterGeneratedBtcByAccount keeps only the chosen accounts; empty keeps all', () => {
  const rows = [
    entry({ entry_day: '2026-07-08', account: MAIN_ACCOUNT_LABEL }),
    entry({ entry_day: '2026-07-09', account: 'Client Alpha' }),
  ];
  assert.equal(filterGeneratedBtcByAccount(rows, []).length, 2);
  assert.deepEqual(
    filterGeneratedBtcByAccount(rows, ['Client Alpha']).map((e) => e.entry_day),
    ['2026-07-09'],
  );
});

test('searchGeneratedBtc matches the account name case-insensitively; a blank query passes all', () => {
  const rows = [
    entry({ entry_day: '2026-07-08', account: MAIN_ACCOUNT_LABEL }),
    entry({ entry_day: '2026-07-09', account: 'Client Alpha' }),
  ];
  assert.deepEqual(searchGeneratedBtc(rows, 'alpha').map((e) => e.entry_day), ['2026-07-09']);
  assert.equal(searchGeneratedBtc(rows, '').length, 2);
  // A row with no account cannot match an account name.
  assert.equal(searchGeneratedBtc([entry({ account: undefined })], 'main').length, 0);
});

test('searchGeneratedBtc searches visible dates, hashrate and BTC amounts in single-account mode', () => {
  const rows = [
    entry({ entry_day: '2026-07-08', hashrate: 100e12, fpps_btc_generated: 0.0123 }),
    entry({ entry_day: '2026-06-21', hashrate: 50e12, fpps_btc_generated: 0.0045 }),
  ];
  for (const query of ['2026-07-08', 'Wednesday 8 July 2026', '100.00 TH/s', '0.0123', '  JUL  ']) {
    assert.deepEqual(searchGeneratedBtc(rows, query), [rows[0]]);
  }
  assert.deepEqual(searchGeneratedBtc(rows, '0.0045 BTC'), [rows[1]]);
  assert.deepEqual(searchGeneratedBtc(rows, 'no match'), []);
  assert.equal(searchGeneratedBtc(rows, '  '), rows);
});

// The GeneratedBtcFilter type is exercised through the calls above.
const _typecheck: GeneratedBtcFilter = EMPTY_GENERATED_BTC_FILTER;
void _typecheck;

test('generatedBtcRowId distinguishes the same day across accounts', () => {
  // In aggregated mode one calendar day appears once per account, so the day alone
  // cannot identify a row.
  const a = { entry_day: '2026-08-01', hashrate: 1, btc_generated: 1 };
  assert.equal(generatedBtcRowId(a), generatedBtcRowId({ ...a }));
  assert.notEqual(
    generatedBtcRowId({ ...a, account: 'Main account' }),
    generatedBtcRowId({ ...a, account: 'Main Farm' }),
  );
  assert.notEqual(generatedBtcRowId(a), generatedBtcRowId({ ...a, account: 'Main Farm' }));
});

function aggregateEntry(day: string, accountId: string, btc: number, hashrate: number): GeneratedBtcEntry {
  return { entry_day: day, accountId, account: 'Shared display name', fpps_btc_generated: btc, hashrate, pplns_btc_generated: 100, btc_generated: btc + 100, pplns_hashrate: 0 };
}

test('combined generated summaries sum accounts by day before averaging hashrate or selecting the best day', () => {
  const rows = [aggregateEntry('2026-10-20', '1', 1, 10), aggregateEntry('2026-10-20', '2', 2, 20), aggregateEntry('2026-10-21', '1', 4, 40), aggregateEntry('2026-10-21', '2', 0.5, 5)];
  const unique = dedupeGeneratedBtc([...rows, rows[0]]);
  assert.equal(unique.length, 4, 'matching display names must not merge different accounts');
  const days = combinedDailyEarnings(unique);
  assert.equal(days.length, 2);
  assert.equal(sumGenerated(days), 7.5);
  assert.equal(averageEntryHashrate(days), 37.5);
  assert.equal(highestEarningDay(days)?.fpps_btc_generated, 4.5);
  assert.equal(highestEarningDay(days)?.entry_day, '2026-10-21');
  assert.equal(rows[0].hashrate, 10, 'account rows must remain unchanged');
});
