import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FIXED_TTL_MS,
  IDLE_TTL_MS,
  STORAGE_KEY,
  createSession,
  isExpired,
  readSession,
  refreshIdle,
  viewingAccountFromAuth,
  writeSession,
} from '../session';

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

const sessionInput = (over: Partial<Parameters<typeof createSession>[0]> = {}) => ({
  accountId: 'a1',
  email: 'm@x.io',
  company_name: 'DMND Mining',
  company_primary_location: 'Lagos, NG',
  kyb_status: 'Approved' as const,
  ...over,
});

test('createSession sets the fixed and idle deadlines from now', () => {
  const s = createSession(sessionInput({ now: 1_000 }));
  assert.equal(s.expiresAt, 1_000 + FIXED_TTL_MS);
  assert.equal(s.idleExpiresAt, 1_000 + IDLE_TTL_MS);
});

test('isExpired trips on either the idle or the fixed deadline', () => {
  const s = createSession(sessionInput({ now: 0 }));
  assert.equal(isExpired(s, IDLE_TTL_MS - 1), false);
  assert.equal(isExpired(s, IDLE_TTL_MS), true); // idle hits first
  const active = refreshIdle(s, FIXED_TTL_MS - 1);
  assert.equal(isExpired(active, FIXED_TTL_MS), true); // fixed cap still applies
});

test('refreshIdle extends only the idle deadline', () => {
  const s = createSession(sessionInput({ now: 0 }));
  const r = refreshIdle(s, 5_000);
  assert.equal(r.expiresAt, s.expiresAt);
  assert.equal(r.idleExpiresAt, 5_000 + IDLE_TTL_MS);
});

test('readSession round-trips a written session', () => {
  const storage = memoryStorage();
  const s = createSession(sessionInput());
  writeSession(s, storage);
  assert.deepEqual(readSession(storage), s);
  assert.equal(readSession(storage)?.company_name, 'DMND Mining');
  assert.equal(readSession(storage)?.company_primary_location, 'Lagos, NG');
  assert.equal(readSession(storage)?.kyb_status, 'Approved');
});

test('readSession returns null for missing, malformed, or invalid core data', () => {
  const storage = memoryStorage();
  assert.equal(readSession(storage), null);

  storage.setItem(STORAGE_KEY, 'not json');
  assert.equal(readSession(storage), null);

  storage.setItem(STORAGE_KEY, JSON.stringify({ accountId: 'a1', expiresAt: 1, idleExpiresAt: 1 }));
  assert.equal(readSession(storage), null); // no email

  storage.setItem(STORAGE_KEY, JSON.stringify({ email: 'm@x.io', expiresAt: 1, idleExpiresAt: 1 }));
  assert.equal(readSession(storage), null); // no accountId

  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({ accountId: 'a1', email: 'm@x.io', expiresAt: 'later', idleExpiresAt: Number.MAX_SAFE_INTEGER }),
  );
  assert.equal(readSession(storage), null); // invalid deadline
});

test('readSession discards and clears an expired session', () => {
  const storage = memoryStorage();
  writeSession(createSession(sessionInput({ now: 0 })), storage);
  // far past both deadlines: stub Date.now via an expired write
  const expired = { ...sessionInput(), expiresAt: 1, idleExpiresAt: 1 };
  storage.setItem(STORAGE_KEY, JSON.stringify(expired));
  assert.equal(readSession(storage), null);
  assert.equal(storage.getItem(STORAGE_KEY), null);
});

test('viewingAccountFromAuth uses log_subaccount AuthResponse.id as the active account', () => {
  const viewing = viewingAccountFromAuth({
    id: 'returned-subaccount-id',
    email: 'sub@x.io',
    company_name: 'DMND Mining',
    company_primary_location: 'Lagos, NG',
    kyb_status: 'Approved',
    token: 'pplns-token',
    fpps_token: 'fpps-token',
    two_factor_secret: null,
    bitcoin_addresses: {},
  });

  assert.deepEqual(viewing, {
    accountId: 'returned-subaccount-id',
    email: 'sub@x.io',
    company_name: 'DMND Mining',
    company_primary_location: 'Lagos, NG',
    kyb_status: 'Approved',
  });
});
