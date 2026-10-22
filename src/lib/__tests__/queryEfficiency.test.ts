import assert from 'node:assert/strict';
import test from 'node:test';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { createWatcherClient, WatcherRequestError } from '@/api/watcherClient';
import type { DmndClient } from '@/api/types';
import { brokerMinersQueryOptions, clearBrokerQueries } from '../brokerQueries';
import { refreshHashrateHistory } from '../incrementalHistory';
import { watcherQueryPolicy } from '../watcherQueries';

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
