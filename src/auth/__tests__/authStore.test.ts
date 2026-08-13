import assert from 'node:assert/strict';
import test from 'node:test';

import { createAuthStore } from '../authStore';
import { createSession } from '../session';
import { createUser, setDmndAccountId } from '@/api/client';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

const minerSession = (over: Partial<Parameters<typeof createSession>[0]> = {}) =>
  createSession({
    accountId: 'master',
    email: 'm@x.io',
    company_name: 'DMND Mining',
    company_primary_location: 'Lagos, NG',
    kyb_status: 'Approved',
    ...over,
  });

const subaccountSession = (accountId: string) => ({
  accountId,
  email: 'sub@x.io',
  company_name: 'DMND Mining',
  company_primary_location: 'Lagos, NG',
  kyb_status: 'Approved' as const,
});

/**
 * An in-process stand-in for BroadcastChannel: every channel built from the
 * same bus delivers postMessage to the others, like tabs of one browser.
 */
function channelBus() {
  const channels: Array<{ onmessage: ((ev: MessageEvent) => void) | null }> = [];
  const make = (): BroadcastChannel => {
    const ch = {
      onmessage: null as ((ev: MessageEvent) => void) | null,
      postMessage(data: unknown) {
        for (const c of channels) {
          if (c !== ch && c.onmessage) c.onmessage({ data } as MessageEvent);
        }
      },
      close() {
        const i = channels.indexOf(ch);
        if (i >= 0) channels.splice(i, 1);
      },
    };
    channels.push(ch);
    return ch as unknown as BroadcastChannel;
  };
  return { make };
}

test('a second tab claiming the same account signs the first tab out', () => {
  const bus = channelBus();
  const session = minerSession({ accountId: '1' });

  const tabA = createAuthStore({ tabId: 'A', storage: memoryStorage(), channelFactory: bus.make });
  tabA.connect();
  tabA.signIn(session);
  assert.equal(tabA.getSnapshot().session?.accountId, '1');

  const tabB = createAuthStore({ tabId: 'B', storage: memoryStorage(), channelFactory: bus.make });
  tabB.connect();
  tabB.signIn(session);

  assert.equal(tabA.getSnapshot().session, null);
  assert.equal(tabA.getSnapshot().signOutReason, 'duplicate_tab');
  assert.equal(tabB.getSnapshot().session?.accountId, '1');
});

test('a tab with a different account is left alone', () => {
  const bus = channelBus();

  const tabA = createAuthStore({ tabId: 'A', storage: memoryStorage(), channelFactory: bus.make });
  tabA.connect();
  tabA.signIn(minerSession({ accountId: '1', email: 'a@x.io' }));

  const tabB = createAuthStore({ tabId: 'B', storage: memoryStorage(), channelFactory: bus.make });
  tabB.connect();
  tabB.signIn(minerSession({ accountId: '2', email: 'b@x.io' }));

  assert.equal(tabA.getSnapshot().session?.accountId, '1');
});

test('a store that never connected is not cleared by another tab claiming the same account', () => {
  // Models the StrictMode case: the store from the double-invoked useState
  // initializer is never mounted, so connect() never runs. It must not listen,
  // or a plain refresh would clear the session (the dev refresh bug).
  const bus = channelBus();
  const session = minerSession({ accountId: '1' });

  const ghost = createAuthStore({ tabId: 'ghost', storage: memoryStorage(), channelFactory: bus.make });
  ghost.signIn(session); // has the session, but never connect()ed

  const live = createAuthStore({ tabId: 'live', storage: memoryStorage(), channelFactory: bus.make });
  live.connect();
  live.signIn(session); // same account claim broadcast on the bus

  // The unconnected store ignored the claim and kept its session.
  assert.equal(ghost.getSnapshot().session?.accountId, '1');
});

test('reconnecting a restored session during refresh does not claim or clear itself', () => {
  const bus = channelBus();
  const storage = memoryStorage();
  const beforeRefresh = createAuthStore({ tabId: 'before', storage, channelFactory: bus.make });
  beforeRefresh.connect();
  beforeRefresh.signIn(minerSession());

  const afterRefresh = createAuthStore({ tabId: 'after', storage, channelFactory: bus.make });
  afterRefresh.connect();

  assert.equal(beforeRefresh.getSnapshot().session?.accountId, 'master');
  assert.equal(afterRefresh.getSnapshot().session?.accountId, 'master');
  assert.equal(afterRefresh.getSnapshot().signOutReason, null);
});

test('setViewingAccount scopes to a subaccount and back to the master account', () => {
  const storage = memoryStorage();
  const store = createAuthStore({ tabId: 'A', storage, channel: null });
  store.signIn(minerSession());

  store.setViewingAccount(subaccountSession('sub-1'));
  assert.equal(store.getSnapshot().viewingAccountId, 'sub-1');
  assert.equal(store.getSnapshot().viewingAccount?.email, 'sub@x.io');

  const restored = createAuthStore({ tabId: 'B', storage, channel: null });
  assert.equal(restored.getSnapshot().viewingAccountId, 'sub-1', 'refresh keeps the selected subaccount');

  store.setViewingAccount(null);
  assert.equal(store.getSnapshot().viewingAccountId, null);
  const restoredMain = createAuthStore({ tabId: 'C', storage, channel: null });
  assert.equal(restoredMain.getSnapshot().viewingAccountId, null);
});

test('restoring a selected subaccount immediately scopes the first API request to it', async () => {
  const storage = memoryStorage();
  const first = createAuthStore({ tabId: 'A', storage, channel: null });
  first.signIn(minerSession());
  first.setViewingAccount(subaccountSession('sub-1'));

  createAuthStore({ tabId: 'B', storage, channel: null });
  const calls: RequestInit[] = [];
  const client = createUser({
    fetchImpl: (async (_url: unknown, init: RequestInit) => {
      calls.push(init);
      return new Response('{}', { status: 200 });
    }) as typeof fetch,
    backoffMs: 0,
  });
  try {
    await client.checkAuth();
    assert.equal((calls[0].headers as Record<string, string>)['X-Account-ID'], 'sub-1');
  } finally {
    setDmndAccountId(null);
  }
});

test('an idle bump keeps the viewed subaccount, but signing in or out resets it', () => {
  const store = createAuthStore({ tabId: 'A', storage: memoryStorage(), channel: null });
  store.signIn(minerSession());
  store.setViewingAccount(subaccountSession('sub-1'));

  // An activity refresh must not kick the miner back to the master account.
  store.bumpActivity();
  assert.equal(store.getSnapshot().viewingAccountId, 'sub-1');

  // Signing out clears the view scope.
  store.signOut();
  assert.equal(store.getSnapshot().viewingAccountId, null);

  // A fresh sign-in starts on the master account, never a stale subaccount.
  store.setViewingAccount(subaccountSession('sub-2'));
  store.signIn(minerSession());
  assert.equal(store.getSnapshot().viewingAccountId, null);
});

test('refreshing session profile fields preserves the selected account and expiry deadlines', () => {
  const storage = memoryStorage();
  const store = createAuthStore({ tabId: 'A', storage, channel: null });
  store.signIn(minerSession({ company_name: null, company_primary_location: null, kyb_status: 'NotStarted' }));
  store.setViewingAccount(subaccountSession('sub-1'));
  const before = store.getSnapshot().session;

  store.updateSessionProfile({
    email: 'updated@x.io',
    company_name: 'Updated Mining',
    company_primary_location: 'Abuja, NG',
    kyb_status: 'Approved',
  });

  const after = store.getSnapshot();
  assert.equal(after.viewingAccountId, 'sub-1');
  assert.equal(after.session?.email, 'updated@x.io');
  assert.equal(after.session?.company_name, 'Updated Mining');
  assert.equal(after.session?.expiresAt, before?.expiresAt);
  assert.equal(after.session?.idleExpiresAt, before?.idleExpiresAt);
  assert.equal(JSON.parse(storage.getItem('dmnd_session') ?? '').company_name, 'Updated Mining');
});
