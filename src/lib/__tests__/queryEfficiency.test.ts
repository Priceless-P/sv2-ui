import assert from 'node:assert/strict';
import test from 'node:test';
import { QueryClient } from '@tanstack/react-query';
import type { DmndClient } from '@/api/types';
import { brokerMinersQueryOptions, clearBrokerQueries } from '../brokerQueries';


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
