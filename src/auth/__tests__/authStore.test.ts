import assert from 'node:assert/strict';
import test from 'node:test';

import { createAuthStore } from '../authStore';
import { createSession } from '../session';
import { createUser, setDmndAccountId, subscribeToDmndAuthRejections } from '@/api/client';
import { actionForRejectedRequest } from '../sessionValidation';

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

test('signing in to the same account in another tab preserves both sessions', () => {
  const bus = channelBus();
  const session = minerSession({ accountId: '1' });

  const tabA = createAuthStore({ tabId: 'A', storage: memoryStorage(), channelFactory: bus.make });
  tabA.connect();
  tabA.signIn(session);
  assert.equal(tabA.getSnapshot().session?.accountId, '1');

  const tabB = createAuthStore({ tabId: 'B', storage: memoryStorage(), channelFactory: bus.make });
  tabB.connect();
  tabB.signIn(session);

  assert.equal(tabA.getSnapshot().session?.accountId, '1');
  assert.equal(tabA.getSnapshot().signOutReason, null);
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

test('signing in or out resets the selected subaccount', () => {
  const store = createAuthStore({ tabId: 'A', storage: memoryStorage(), channel: null });
  store.signIn(minerSession());
  store.setViewingAccount(subaccountSession('sub-1'));

  assert.equal(store.getSnapshot().viewingAccountId, 'sub-1');

  // Signing out clears the view scope.
  store.signOut();
  assert.equal(store.getSnapshot().viewingAccountId, null);

  // A fresh sign-in starts on the master account, never a stale subaccount.
  store.setViewingAccount(subaccountSession('sub-2'));
  store.signIn(minerSession());
  assert.equal(store.getSnapshot().viewingAccountId, null);
});

test('a session and selected subaccount survive elapsed time and a page reload', (t) => {
  const storage = memoryStorage();
  const store = createAuthStore({ tabId: 'A', storage, channel: null });
  store.signIn(minerSession());
  store.setViewingAccount(subaccountSession('sub-1'));
  const session = store.getSnapshot().session;
  const later = Date.now() + 24 * 60 * 60 * 1000;
  t.mock.method(Date, 'now', () => later);
  const restored = createAuthStore({ tabId: 'B', storage, channel: null });
  assert.equal(store.getSnapshot().session?.loginId, session?.loginId);
  assert.equal(restored.getSnapshot().session?.loginId, session?.loginId);
  assert.equal(restored.getSnapshot().viewingAccountId, 'sub-1');
  assert.equal(restored.getSnapshot().signOutReason, null);
});

test('refreshing session profile fields preserves the selected account and login identity', () => {
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
  assert.equal(after.session?.loginId, before?.loginId);
  assert.equal(JSON.parse(storage.getItem('dmnd_session') ?? '').company_name, 'Updated Mining');
});

test('remembering a sign-in stores it outside the tab, and not remembering keeps it in the tab', () => {
  const tab = memoryStorage();
  const remembered = memoryStorage();

  const store = createAuthStore({ tabId: 'A', storage: tab, persistentStorage: remembered, channel: null });
  store.signIn(minerSession({ remember: true }));
  assert.equal(remembered.getItem('dmnd_session') !== null, true, 'kept where it survives the tab');
  assert.equal(tab.getItem('dmnd_session'), null, 'not duplicated into the tab slot');

  // Signing in again without the box ticked moves the session back to the tab and
  // leaves nothing behind in the persistent slot.
  store.signIn(minerSession({ remember: false }));
  assert.equal(tab.getItem('dmnd_session') !== null, true);
  assert.equal(remembered.getItem('dmnd_session'), null);
});

test('a remembered session is restored in a brand-new tab; an ordinary one is not', () => {
  const remembered = memoryStorage();
  const first = createAuthStore({
    tabId: 'A',
    storage: memoryStorage(),
    persistentStorage: remembered,
    channel: null,
  });
  first.signIn(minerSession({ remember: true }));

  // A fresh tab: its own empty sessionStorage, the same persistent slot.
  const newTab = createAuthStore({
    tabId: 'B',
    storage: memoryStorage(),
    persistentStorage: remembered,
    channel: null,
  });
  assert.equal(newTab.getSnapshot().session?.accountId, 'master');
  assert.equal(newTab.getSnapshot().session?.remember, true);
  // A remembered session comes back on the master account, not a stale subaccount.
  assert.equal(newTab.getSnapshot().viewingAccountId, null);

  const notRemembered = createAuthStore({
    tabId: 'C',
    storage: memoryStorage(),
    persistentStorage: memoryStorage(),
    channel: null,
  });
  notRemembered.signIn(minerSession({ remember: false }));
  const anotherTab = createAuthStore({
    tabId: 'D',
    storage: memoryStorage(),
    persistentStorage: memoryStorage(),
    channel: null,
  });
  assert.equal(anotherTab.getSnapshot().session, null);
});

test('later writes stay in the slot the session lives in', () => {
  const tab = memoryStorage();
  const remembered = memoryStorage();
  const store = createAuthStore({ tabId: 'A', storage: tab, persistentStorage: remembered, channel: null });
  store.signIn(minerSession({ remember: true }));

  store.updateSessionProfile({
    email: 'updated@x.io',
    company_name: 'Updated Mining',
    company_primary_location: 'Abuja, NG',
    kyb_status: 'Approved',
  });

  assert.equal(tab.getItem('dmnd_session'), null, 'a refresh must not migrate the session');
  assert.equal(JSON.parse(remembered.getItem('dmnd_session') ?? '').email, 'updated@x.io');
  assert.equal(JSON.parse(remembered.getItem('dmnd_session') ?? '').remember, true);
});

test('signing out clears both slots, so nothing can be restored from the other one', () => {
  const tab = memoryStorage();
  const remembered = memoryStorage();
  const store = createAuthStore({ tabId: 'A', storage: tab, persistentStorage: remembered, channel: null });
  store.signIn(minerSession({ remember: true }));

  store.signOut();
  assert.equal(remembered.getItem('dmnd_session'), null);
  assert.equal(tab.getItem('dmnd_session'), null);
  assert.equal(
    createAuthStore({ tabId: 'B', storage: tab, persistentStorage: remembered, channel: null }).getSnapshot()
      .session,
    null,
  );
});

test('a second sign-in does not clear the remembered session in another tab', () => {
  const bus = channelBus();
  const remembered = memoryStorage();

  const tabA = createAuthStore({
    tabId: 'A',
    storage: memoryStorage(),
    persistentStorage: remembered,
    channelFactory: bus.make,
  });
  tabA.connect();
  tabA.signIn(minerSession({ accountId: '1', remember: true }));

  const tabB = createAuthStore({
    tabId: 'B',
    storage: memoryStorage(),
    persistentStorage: memoryStorage(),
    channelFactory: bus.make,
  });
  tabB.connect();
  tabB.signIn(minerSession({ accountId: '1' }));

  assert.equal(tabA.getSnapshot().session?.accountId, '1');
  assert.notEqual(remembered.getItem('dmnd_session'), null);
});

test('remembering degrades to an ordinary session when there is nowhere persistent to store it', () => {
  const tab = memoryStorage();
  const store = createAuthStore({ tabId: 'A', storage: tab, persistentStorage: null, channel: null });
  store.signIn(minerSession({ remember: true }));
  assert.equal(store.getSnapshot().session?.accountId, 'master');
  assert.equal(tab.getItem('dmnd_session') !== null, true);
});

test('explicit logout clears matching sessions in other tabs', () => {
  const bus = channelBus();
  const session = minerSession();
  const storageA = memoryStorage();
  const storageB = memoryStorage();
  storageA.setItem('dmnd_session', JSON.stringify(session));
  storageB.setItem('dmnd_session', JSON.stringify(session));
  const a = createAuthStore({ storage: storageA, channelFactory: bus.make });
  const b = createAuthStore({ storage: storageB, channelFactory: bus.make });
  a.connect(); b.connect();
  try {
    a.signOut('user');
    assert.equal(b.getSnapshot().session, null);
    assert.equal(b.getSnapshot().signOutReason, 'user');
  } finally { a.teardown(); b.teardown(); }
});

test('backend-confirmed expiry clears matching tabs with the expired reason', () => {
  const bus = channelBus();
  const session = minerSession();
  const storageA = memoryStorage();
  const storageB = memoryStorage();
  storageA.setItem('dmnd_session', JSON.stringify(session));
  storageB.setItem('dmnd_session', JSON.stringify(session));
  const a = createAuthStore({ storage: storageA, channelFactory: bus.make });
  const b = createAuthStore({ storage: storageB, channelFactory: bus.make });
  a.connect(); b.connect();
  try {
    a.signOut('expired');
    assert.equal(b.getSnapshot().session, null);
    assert.equal(b.getSnapshot().signOutReason, 'expired');
  } finally { a.teardown(); b.teardown(); }
});

test('an unknown cross-tab message does not expire a session', () => {
  const bus = channelBus();
  const store = createAuthStore({ tabId: 'current', storage: memoryStorage(), channelFactory: bus.make });
  store.connect();
  store.signIn(minerSession());
  const other = bus.make();
  try {
    other.postMessage({ type: 'CLAIM_SESSION', tabId: 'old-frontend', accountId: 'master' });
    assert.equal(store.getSnapshot().session?.accountId, 'master');
    assert.equal(store.getSnapshot().signOutReason, null);
  } finally {
    other.close();
    store.teardown();
  }
});

test('network, server, and permission failures keep the session; only backend auth rejection ends it', async () => {
  const store = createAuthStore({ storage: memoryStorage(), channel: null });
  store.signIn(minerSession());
  const initialLoginId = store.getSnapshot().session?.loginId;
  let status = 200;
  const client = createUser({
    maxAttempts: 1,
    fetchImpl: async () => {
      if (status === 0) throw new TypeError('Offline');
      return Response.json(status === 400 ? { message: 'User not found' } : {}, { status });
    },
  });
  const unsubscribe = subscribeToDmndAuthRejections(({ accountId }) => {
    const action = actionForRejectedRequest(store.getSnapshot(), accountId);
    if (action === 'sign-out') store.signOut('expired');
    else if (action === 'leave-subaccount') store.setViewingAccount(null);
  });
  try {
    for (status of [0, 503, 403]) {
      await assert.rejects(client.checkAuth({ accountId: 'master' }));
      assert.equal(store.getSnapshot().session?.loginId, initialLoginId);
    }

    status = 401;
    store.setViewingAccount(subaccountSession('sub-1'));
    await assert.rejects(client.checkAuth({ accountId: 'sub-1' }));
    assert.equal(store.getSnapshot().session?.loginId, initialLoginId);
    assert.equal(store.getSnapshot().viewingAccountId, null);

    await assert.rejects(client.checkAuth({ accountId: 'master' }));
    assert.equal(store.getSnapshot().session, null);
    assert.equal(store.getSnapshot().signOutReason, 'expired');

    store.signIn(minerSession());
    status = 400;
    await assert.rejects(client.checkAuth({ accountId: 'master' }));
    assert.equal(store.getSnapshot().session, null);
    assert.equal(store.getSnapshot().signOutReason, 'expired');
  } finally {
    unsubscribe();
    store.teardown();
    setDmndAccountId(null);
  }
});
