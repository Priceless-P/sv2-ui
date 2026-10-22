import { accountPayoutQueryOptions } from '../payoutsTable';
import { workerPresenceQueryOptions } from '@/hooks/useAccountData';
import { isAggregatedRestrictedRoute } from '@/components/dashboard/nav';
import assert from 'node:assert/strict';
import test from 'node:test';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { createUser } from '@/api/client';
import { createWatcherClient, WatcherRequestError } from '@/api/watcherClient';
import type { DmndClient } from '@/api/types';
import { loadSubaccountRows, loadSubaccountWorkerGroups } from '@/hooks/useSubaccounts';
import { brokerMinersQueryOptions, clearBrokerQueries } from '../brokerQueries';
import { refreshHashrateHistory } from '../hashrateHistory';
import { watcherQueryPolicy } from '../watcherQueries';

test('aggregate refresh reloads snapshots at the next polling boundary and reuses them within that boundary', async (t) => {
  let now = Date.parse('2026-10-21T12:04:00Z');
  t.mock.method(Date, 'now', () => now);
  let summaryReads = 0;
  const client = createUser({ fetchImpl: async (url) => {
    const path = new URL(String(url)).pathname;
    const body = path.endsWith('/sub_account')
      ? [{ id: 'a', sub_account: 'A', token: 'a', fpps_token: null, hashrate: '999', bitcoin_addresses: {} }]
      : { hashrate: { total_hashrate: ++summaryReads }, share_stats: { accepted: 1, rejected: 0 }, today_generated_btc: 0 };
    return new Response(JSON.stringify(body));
  } });
  const cache = new QueryClient();
  const signal = new AbortController().signal;
  try {
    await loadSubaccountRows(cache, client, 'owner', false, signal);
    now += 30_000;
    await loadSubaccountRows(cache, client, 'owner', false, signal);
    assert.equal(summaryReads, 1, 'a second consumer reuses the current snapshot');
    now = Date.parse('2026-10-21T12:05:01Z');
    await loadSubaccountRows(cache, client, 'owner', false, signal);
    assert.equal(summaryReads, 2, 'the next shared tick must not retain the previous snapshot');
  } finally { cache.clear(); }
});

test('Subaccounts requests summaries without workers, then aggregate views reuse cached resources', async () => {
  const calls: string[] = [];
  const client = createUser({ fetchImpl: async (url) => {
    const path = new URL(String(url)).pathname;
    calls.push(path);
    const body = path.endsWith('/sub_account')
      ? ['a', 'b'].map((id) => ({ id, sub_account: id, token: id, fpps_token: null, hashrate: '0', bitcoin_addresses: {} }))
      : path.endsWith('/summary') ? { hashrate: {}, share_stats: { accepted: 1, rejected: 0 }, today_generated_btc: 1 }
        : { workers: [], next_cursor: null };
    return new Response(JSON.stringify(body));
  } });
  const cache = new QueryClient();
  const signal = new AbortController().signal;
  try {
    const rows = await loadSubaccountRows(cache, client, 'owner', false, signal);
    assert.equal(rows.length, 2);
    assert.equal(calls.length, 3, 'one list and two summaries');
    assert.ok(calls.every((path) => !path.endsWith('/workers')));
    await loadSubaccountRows(cache, client, 'owner', true, signal);
    assert.equal(calls.length, 5, 'only the missing two rosters are loaded');
    await loadSubaccountWorkerGroups(cache, client, 'owner', rows.map((row) => ({ id: row.id } as never)), signal);
    assert.equal(calls.length, 5, 'Workers reuses both rosters without earnings or summary reads');
  } finally { cache.clear(); }
});

test('broker identities cannot share rows and logout removes an in-flight response', async () => {
  const cache = new QueryClient();
  const client = { brokerMiners: async (_height: number, options: { brokerId: string }) => [{ id: options.brokerId }] } as unknown as DmndClient;
  try {
    const a = brokerMinersQueryOptions(client, 'A', 0);
    const b = brokerMinersQueryOptions(client, 'B', 0);
    assert.equal((await cache.fetchQuery(a))[0].id, 'A');
    assert.equal((await cache.fetchQuery(b))[0].id, 'B');
    let release!: () => void;
    const waiting = new Promise<void>((resolve) => { release = resolve; });
    const late = cache.fetchQuery({ ...a, staleTime: 0, queryFn: async () => { await waiting; return [{ id: 'late A' }]; } });
    const rejected = assert.rejects(late);
    clearBrokerQueries(cache);
    release();
    await rejected;
    assert.equal(cache.getQueryData(a.queryKey), undefined);
    assert.equal(cache.getQueryData(b.queryKey), undefined);
  } finally { cache.clear(); }
});

test('rolling history reads only the missing tail, replaces overlap, and evicts old samples', async () => {
  const point = (minute: number, total = minute) => ({ observed_at: new Date(minute * 60_000).toISOString(), total_hashrate: total, pplns_hashrate: total, fpps_hashrate: 0 });
  const window = (from: number, to: number) => ({ from: new Date(from * 60_000).toISOString(), to: new Date(to * 60_000).toISOString() });
  const first = await refreshHashrateHistory(undefined, window(0, 60), async () => [point(0), point(30), point(58), point(60)]);
  let requestedFrom = '';
  const next = await refreshHashrateHistory(first, window(5, 65), async (from) => {
    requestedFrom = from;
    return [point(58, 999), point(62), point(64)];
  });
  assert.equal(requestedFrom, new Date(56 * 60_000).toISOString());
  assert.deepEqual(next.points.map((p) => p.total_hashrate), [30, 999, 60, 62, 64]);
  let resetFrom = '';
  await refreshHashrateHistory(next, window(70, 130), async (from) => { resetFrom = from; return []; });
  assert.equal(resetFrom, new Date(70 * 60_000).toISOString(), 'a disjoint window requires bootstrap');
});

test('a denied watcher scope disables future automatic reads; a revoked token blocks all reads', async () => {
  const cache = new QueryClient();
  let calls = 0;
  const observer = new QueryObserver(cache, {
    queryKey: ['watcher', 'test', 'hashrate'],
    queryFn: async () => { calls++; throw new WatcherRequestError('denied', 403); },
    ...watcherQueryPolicy(true, false),
  });
  const stop = observer.subscribe(() => {});
  try {
    await observer.refetch();
    assert.equal(observer.getCurrentResult().isEnabled, false);
    const previousCalls = calls;
    await cache.invalidateQueries();
    assert.equal(calls, previousCalls);
    assert.equal(watcherQueryPolicy(false, false).enabled({ state: { error: null } }), false, 'hidden mode does not load');
    assert.equal(watcherQueryPolicy(true, true).enabled({ state: { error: null } }), false, 'revocation blocks other scopes');
    assert.equal(watcherQueryPolicy(true, false).enabled({ state: { error: new Error('offline') } }), true, 'transient failures remain recoverable');
  } finally { stop(); cache.clear(); }
});

test('watcher 403 keeps the token usable, while 401 prevents subsequent endpoint and cursor reads', async () => {
  let revoked = false;
  let calls = 0;
  const client = createWatcherClient('fixture', {
    onUnauthorized: () => { revoked = true; }, isRevoked: () => revoked,
    fetchImpl: async () => new Response('{}', { status: ++calls === 1 ? 403 : 401 }),
  });
  await assert.rejects(client.getFees());
  assert.equal(revoked, false);
  await assert.rejects(client.getHashrate());
  assert.equal(revoked, true);
  await assert.rejects(client.getAllWorkers());
  assert.equal(calls, 2);
});

test('aggregate navigation excludes subaccounts and permits the combined PPLNS view', () => {
  assert.equal(isAggregatedRestrictedRoute('/subaccounts'), true);
  assert.equal(isAggregatedRestrictedRoute('/pplns-projection'), false);
});

test('Home and payout history reuse records for thirty minutes without crossing account scopes', async (t) => {
  let now = Date.parse('2026-10-22T12:00:00Z');
  t.mock.method(Date, 'now', () => now);
  const calls: string[] = [];
  const client = {
    getSubaccountPayouts: async (id: string) => { calls.push(id); return []; },
    getPayouts: async () => { calls.push('tree'); return []; },
  } as unknown as DmndClient;
  const cache = new QueryClient();
  try {
    const options = accountPayoutQueryOptions(client, 'owner', 'sub', false);
    assert.equal(options.refetchInterval({ state: { dataUpdatedAt: now } }), 30 * 60_000);
    await cache.fetchQuery(options);
    now += 29 * 60_000;
    assert.equal(options.refetchInterval({ state: { dataUpdatedAt: now - 29 * 60_000 } }), 60_000, 'navigation must retain the original refresh deadline');
    await cache.fetchQuery(accountPayoutQueryOptions(client, 'owner', 'sub', false));
    assert.deepEqual(calls, ['sub']);
    await cache.fetchQuery(accountPayoutQueryOptions(client, 'owner', 'other', false));
    await cache.fetchQuery(accountPayoutQueryOptions(client, 'owner', 'sub', true));
    assert.deepEqual(calls, ['sub', 'other', 'tree']);
    now += 60_000;
    await cache.fetchQuery(options);
    assert.deepEqual(calls, ['sub', 'other', 'tree', 'sub']);
  } finally { cache.clear(); }
});

test('setup worker existence uses limit=1 and never follows a cursor', async () => {
  const urls: string[] = [];
  const client = createUser({ fetchImpl: async (url) => {
    urls.push(String(url));
    return new Response(JSON.stringify({ workers: [{ name: 'rig' }], next_cursor: 'more' }));
  } });
  assert.equal(await client.hasWorkers({ accountId: 'owner' }), true);
  assert.equal(urls.length, 1);
  assert.equal(new URL(urls[0]).searchParams.get('limit'), '1');
});

test('setup stops checking once a worker is found and reuses an existing roster', async (t) => {
  let now = Date.parse('2026-10-22T12:00:00Z');
  t.mock.method(Date, 'now', () => now);
  let reads = 0;
  const client = { hasWorkers: async () => { reads++; return true; } } as unknown as DmndClient;
  const cache = new QueryClient();
  try {
    const options = workerPresenceQueryOptions(cache, client, 'owner');
    assert.equal(await cache.fetchQuery(options), true);
    now += 60 * 60_000;
    assert.equal(await cache.fetchQuery(options), true);
    assert.equal(reads, 1);
    assert.equal(options.refetchInterval({ state: { data: true } }), false);
    cache.setQueryData(['account', 'workers-all', 'sub'], [{ name: 'cached-rig' }]);
    assert.equal(await cache.fetchQuery(workerPresenceQueryOptions(cache, client, 'sub')), true);
    assert.equal(reads, 1);
  } finally { cache.clear(); }
});

test('an old empty roster cannot prevent setup from discovering a new worker', async (t) => {
  let now = Date.parse('2026-10-22T12:00:00Z');
  t.mock.method(Date, 'now', () => now);
  const cache = new QueryClient();
  try {
    cache.setQueryData(['account', 'workers-all', 'owner'], []);
    now += 6 * 60_000;
    const client = { hasWorkers: async () => true } as unknown as DmndClient;
    assert.equal(await cache.fetchQuery(workerPresenceQueryOptions(cache, client, 'owner')), true);
  } finally { cache.clear(); }
});

test('hidden watcher resources probe once and resume only for their visible section', () => {
  const pending = { state: { error: null, dataUpdatedAt: 0, errorUpdatedAt: 0 } };
  const success = { state: { error: null, dataUpdatedAt: 1, errorUpdatedAt: 0 } };
  assert.equal(watcherQueryPolicy(true, false, false).enabled(pending), true);
  assert.equal(watcherQueryPolicy(true, false, false).enabled(success), false);
  assert.equal(watcherQueryPolicy(true, false, true).enabled(success), true);
  assert.equal(watcherQueryPolicy(true, true, true).enabled(success), false);
  assert.equal(watcherQueryPolicy(true, false, true).enabled({ state: { error: new WatcherRequestError('denied', 403) } }), false);
  assert.equal(isAggregatedRestrictedRoute('/watcher-links'), true);
});
