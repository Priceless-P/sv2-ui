import assert from 'node:assert/strict';
import test from 'node:test';
import { QueryClient } from '@tanstack/react-query';
import { createUser, setDmndAccountId } from '../client';
import { queryClient } from '@/lib/queryClient';

test('imperative cache reads do not multiply transport retries', async () => {
  let calls = 0;
  const client = createUser({ backoffMs: 0, fetchImpl: async () => {
    calls++;
    return new Response('{}', { status: 503 });
  } });
  const cache = new QueryClient({ defaultOptions: { queries: {
    ...queryClient.getDefaultOptions().queries, retryDelay: 0,
  } } });
  try {
    await assert.rejects(cache.fetchQuery({ queryKey: ['list'], queryFn: () => client.getSubaccounts() }));
    assert.equal(calls, 3);
  } finally { cache.clear(); }
});

test('state-changing authentication requests are never replayed on server failure', async () => {
  const counts = new Map<string, number>();
  const client = createUser({ backoffMs: 0, fetchImpl: async (url) => {
    const path = new URL(String(url)).pathname;
    counts.set(path, (counts.get(path) ?? 0) + 1);
    return new Response('{}', { status: 503 });
  } });
  await assert.rejects(client.signup({ email: 'test@example.invalid', password: 'pw', firstName: 'A', lastName: 'B' }));
  await assert.rejects(client.brokerLogin('test@example.invalid', 'pw'));
  await assert.rejects(client.brokerSignup({ email: 'test@example.invalid', password: 'pw', firstName: 'A', lastName: 'B', companyName: '', companyLocation: '' }));
  await assert.rejects(client.forgotPassword('test@example.invalid'));
  await assert.rejects(client.resetPassword('test@example.invalid', 'code', '123456', 'pw'));
  await assert.rejects(client.logout({ accountId: 'master' }));
  for (const [path, count] of counts) assert.equal(count, 1, path);
});

test('a retry stays scoped to the account that started the request', async () => {
  const accounts: unknown[] = [];
  const client = createUser({ backoffMs: 0, maxAttempts: 2, fetchImpl: async (_url, init) => {
    accounts.push(new Headers(init?.headers).get('X-Account-ID'));
    setDmndAccountId('new-account');
    return new Response('{}', { status: accounts.length === 1 ? 503 : 200 });
  } });
  setDmndAccountId('original-account');
  try {
    await client.getHashrate();
    assert.deepEqual(accounts, ['original-account', 'original-account']);
  } finally { setDmndAccountId(null); }
});

test('logout discovery cannot end the local session before delegated cleanup finishes', async () => {
  const { subscribeToDmndAuthRejections } = await import('../client');
  let rejections = 0;
  const stop = subscribeToDmndAuthRejections(() => { rejections++; });
  const client = createUser({ fetchImpl: async () => new Response('{}', { status: 401 }) });
  try {
    await assert.rejects(client.getSubaccounts({ accountId: 'owner', suppressAuthRejection: true }));
    assert.equal(rejections, 0);
  } finally { stop(); }
});
