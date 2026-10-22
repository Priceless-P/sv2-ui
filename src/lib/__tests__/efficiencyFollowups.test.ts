import assert from 'node:assert/strict';
import test from 'node:test';
import { QueryClient } from '@tanstack/react-query';
import { createUser } from '@/api/client';
import type { DmndClient } from '@/api/types';
import { accountPayoutQueryOptions } from '../payoutQueries';
import { workerPresenceQueryOptions } from '../workerPresence';

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
