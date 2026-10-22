import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DmndClient, GeneratedBtcEntry, PayoutRecord } from '@/api/types';
import { combinedDailyEarnings } from '@/lib/generatedBtcTable';
import { averageEntryHashrate, dedupeGeneratedBtc, highestEarningDay, sumGenerated } from '@/lib/generatedBtcTable';
import { loadTodayPayouts } from '@/lib/payoutsTable';
import { WorkerStatCardsView } from '@/components/home/WorkerStatCards';

function entry(day: string, accountId: string, btc: number, hashrate: number): GeneratedBtcEntry {
  return { entry_day: day, accountId, account: 'Shared display name', fpps_btc_generated: btc, hashrate, pplns_btc_generated: 100, btc_generated: btc + 100, pplns_hashrate: 0 };
}

test('combined generated summaries sum accounts by day before averaging hashrate or selecting the best day', () => {
  const rows = [entry('2026-10-20', '1', 1, 10), entry('2026-10-20', '2', 2, 20), entry('2026-10-21', '1', 4, 40), entry('2026-10-21', '2', 0.5, 5)];
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

test('today payouts use one tree request in aggregate mode and an exact account request in single mode', async () => {
  const rows: PayoutRecord[] = [
    { txid: 'shared', output_index: 0, amount_sats: 10, address: 'same-wallet', kind: 'fpps', confirmed_at: Date.parse('2026-10-21T00:00:00Z') / 1000 },
    { txid: 'shared', output_index: 1, amount_sats: 20, address: 'same-wallet', kind: 'pplns', confirmed_at: Date.parse('2026-10-21T23:59:59Z') / 1000 },
    { txid: 'old', output_index: 0, amount_sats: 90, address: 'wallet', kind: 'fpps', confirmed_at: Date.parse('2026-10-20T23:59:59Z') / 1000 },
    { txid: 'future', output_index: 0, amount_sats: 90, address: 'wallet', kind: 'fpps', confirmed_at: Date.parse('2026-10-22T00:00:00Z') / 1000 },
  ];
  const calls: unknown[] = [];
  const client: Pick<DmndClient, 'getPayouts' | 'getSubaccountPayouts'> = {
    getPayouts: async (query, req) => { calls.push(['tree', query, req?.accountId]); return rows; },
    getSubaccountPayouts: async (id, query, req) => { calls.push([id, query, req?.accountId]); return rows; },
  };
  const options = { ownerAccountId: 'owner', accountId: 'selected', today: '2026-10-21' };
  assert.equal(await loadTodayPayouts(client, { ...options, aggregated: true }), 30 / 1e8);
  assert.deepEqual(calls, [['tree', { from: options.today, to: options.today }, 'owner']]);
  calls.length = 0;
  assert.equal(await loadTodayPayouts(client, { ...options, aggregated: false }), 30 / 1e8);
  assert.deepEqual(calls, [['selected', { from: options.today, to: options.today }, 'owner']]);
});

test('aggregate home earnings display supplied confirmed payouts rather than accrued generated earnings', () => {
  const aggregated = { totalWorkers: 0, activeWorkers: 0, offlineWorkers: 0, combinedHashrate: 0, todayEarnings: 9, rejectionRate: null };
  const html = renderToStaticMarkup(createElement(WorkerStatCardsView, { aggregated, earnings: 0.01 }));
  assert.match(html, />0\.01<\/span>/);
  assert.match(html, /Paid out today across all accounts \(UTC\)/);
  assert.doesNotMatch(html, /Generated today|>9<\/span>/);
  const unknown = renderToStaticMarkup(createElement(WorkerStatCardsView, { aggregated }));
  assert.doesNotMatch(unknown, />9<\/span>/);
});
