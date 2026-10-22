import type { Payout } from '@/lib/payoutsTable';
import { PayoutStatCards } from '@/components/payouts/PayoutStatCards';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { GeneratedBtcTable } from '@/components/generated-btc/GeneratedBtcTable';
import { PayoutsTable } from '@/components/payouts/PayoutsTable';
import { PplnsProjectionPanel } from '@/components/pplns-projection/PplnsProjectionPanel';
import { PplnsProjectionStatCards } from '@/components/pplns-projection/PplnsProjectionStatCards';
import { pplnsProjectionFixture } from '@/api/__tests__/pplnsProjectionFixture';
import { generatedBtcRowId } from '@/lib/generatedBtcTable';

test('payouts no longer expose row selection', () => {
  const html = renderToStaticMarkup(createElement(PayoutsTable, { payouts: [{
    date: 1, txid: 'tx', amountSats: 1, mode: 'fpps', toAddress: 'addr', outputIndex: 0, fromAddress: '',
  }] }));
  assert.doesNotMatch(html, /role="checkbox"/);
});

test('generated BTC selection identifies accounts separately when they share a date', () => {
  const entries = ['Main account', 'Farm'].map((account) => ({
    entry_day: '2026-10-21', account, hashrate: 1, pplns_hashrate: 0, fpps_btc_generated: 0.001, pplns_btc_generated: 0, btc_generated: 0.001,
  }));
  const html = renderToStaticMarkup(createElement(GeneratedBtcTable, {
    entries, showAccount: true, selected: new Set([generatedBtcRowId(entries[1])]), someSelected: true,
  }));
  assert.match(html, /aria-checked="mixed"/);
  assert.match(html, /aria-checked="false" aria-label="Select generated BTC for 2026-10-21 \(Main account\)"/);
  assert.match(html, /aria-checked="true" aria-label="Select generated BTC for 2026-10-21 \(Farm\)"/);
});

test('PPLNS projection has a persistent page heading and working selection controls', () => {
  const projection = pplnsProjectionFixture();
  const html = renderToStaticMarkup(createElement(PplnsProjectionPanel, { projection, isLoading: false, isError: false }));
  assert.match(html, /<h2[^>]*>PPLNS projection<\/h2>/);
  assert.match(html, /Track your retained mining work and projected PPLNS rewards/);
  assert.match(html, /Select all PPLNS work days/);
  assert.match(html, /Select PPLNS work for 2026-08-31/);
  const loading = renderToStaticMarkup(createElement(PplnsProjectionPanel, { projection: undefined, isLoading: true, isError: false }));
  assert.match(loading, /<h2[^>]*>PPLNS projection<\/h2>/);
  const readonly = renderToStaticMarkup(createElement(PplnsProjectionPanel, { projection, isLoading: false, isError: false, selectable: false }));
  assert.doesNotMatch(readonly, /role="checkbox"/);
});

test('PPLNS average hashrate averages the daily rates instead of summing them', () => {
  const base = pplnsProjectionFixture().daily_work[0];
  const dailyWork = [1000, 3000].map((rate, index) => ({
    ...base,
    work_day: `2026-08-${30 + index}`,
    retained_difficulty: rate * 86400 / 2 ** 32,
  }));
  const html = renderToStaticMarkup(createElement(PplnsProjectionStatCards, { dailyWork }));
  assert.match(html, /Average PPLNS hashrate/);
  assert.match(html, /2 KH\/s/);
  assert.doesNotMatch(html, /4 KH\/s/);
  const empty = renderToStaticMarkup(createElement(PplnsProjectionStatCards, { dailyWork: [] }));
  assert.doesNotMatch(empty, /NaN|Infinity/);
  assert.match(empty, />--<\/span>/);
});

const payouts: Payout[] = [{
  date: Date.UTC(2026, 5, 21, 10) / 1000,
  txid: 'tx',
  amountSats: 241_000,
  mode: 'fpps',
  toAddress: 'bc1quser',
  outputIndex: 0,
  fromAddress: '',
}];

test('payout cards show BTC amounts with static captions', () => {
  const html = renderToStaticMarkup(createElement(PayoutStatCards, { payouts, isLoading: false, isError: false }));
  assert.match(html, /Total paid out/);
  assert.match(html, /Total payout count/);
  assert.match(html, /0\.00241/);
  assert.match(html, /Most recent confirmed payout/);
  assert.match(html, /Last 30 days \(UTC\)/);
  assert.doesNotMatch(html, /All-time/);
});

test('payout cards distinguish empty history from loading and failed data', () => {
  const empty = renderToStaticMarkup(createElement(PayoutStatCards, { payouts: [], isLoading: false, isError: false }));
  assert.match(empty, /Most recent confirmed payout/);
  assert.equal((empty.match(/>0<\/span>/g) ?? []).length, 2);

  for (const state of [{ isLoading: true, isError: false }, { isLoading: false, isError: true }]) {
    // Cached rows must not look current when a refresh fails.
    const html = renderToStaticMarkup(createElement(PayoutStatCards, { payouts, ...state }));
    assert.equal((html.match(/>--<\/span>/g) ?? []).length, 3);
    assert.doesNotMatch(html, /0\.00241/);
    assert.match(html, /Last 30 days \(UTC\)/);
    assert.match(html, /Confirmed outputs over 30 days/);
    assert.match(html, /Most recent confirmed payout/);
    assert.doesNotMatch(html, /Loading payouts|Payout statistics unavailable/);
  }
});
