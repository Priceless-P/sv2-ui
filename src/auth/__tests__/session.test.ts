import assert from 'node:assert/strict';
import test from 'node:test';

import {
  REMEMBER_EMAIL_KEY,
  STORAGE_KEY,
  clearRememberedEmail,
  createSession,
  readRememberedEmail,
  readSession,
  viewingAccountFromAuth,
  writeRememberedEmail,
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

test('new sessions have a unique login id and no frontend expiry deadlines', () => {
  const first = createSession(sessionInput());
  const second = createSession(sessionInput());
  assert.ok(first.loginId);
  assert.notEqual(first.loginId, second.loginId);
  assert.equal('expiresAt' in first, false);
  assert.equal('idleExpiresAt' in first, false);
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
    JSON.stringify({ accountId: '', email: 'm@x.io' }),
  );
  assert.equal(readSession(storage), null); // empty account id

  storage.setItem(STORAGE_KEY, JSON.stringify(sessionInput()));
  assert.equal(readSession(storage), null); // no login id
  assert.equal(storage.getItem(STORAGE_KEY), null);
});

test('a stored session is read back whatever the clock says', (t) => {
  const storage = memoryStorage();
  const stored = createSession(sessionInput());
  writeSession(stored, storage);
  t.mock.method(Date, 'now', () => 24 * 60 * 60 * 1000);
  assert.equal(readSession(storage)?.accountId, 'a1');
  assert.equal(readSession(storage)?.loginId, stored.loginId);
  assert.notEqual(storage.getItem(STORAGE_KEY), null);
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

test('remembering affects storage preference without creating a local deadline', () => {
  const ordinary = createSession(sessionInput());
  const remembered = createSession(sessionInput({ remember: true }));
  assert.equal(ordinary.remember, false);
  assert.equal(remembered.remember, true);
  assert.equal('expiresAt' in remembered, false);
  assert.equal('idleExpiresAt' in remembered, false);
});

test('readSession round-trips the remembered flag', () => {
  const storage = memoryStorage();
  writeSession(createSession(sessionInput({ remember: true })), storage);
  assert.equal(readSession(storage)?.remember, true);
});

test('a stored session without the remember flag reads as not remembered', () => {
  const storage = memoryStorage();
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      accountId: 'a1',
      email: 'm@x.io',
      company_name: null,
      company_primary_location: null,
      kyb_status: 'Approved',
      loginId: 'login-1',
    }),
  );
  assert.equal(readSession(storage)?.remember, false);
});

test('the remembered email round-trips and is cleared on request', () => {
  const storage = memoryStorage();
  assert.equal(readRememberedEmail(storage), null);

  writeRememberedEmail('m@x.io', storage);
  assert.equal(storage.getItem(REMEMBER_EMAIL_KEY), 'm@x.io');
  assert.equal(readRememberedEmail(storage), 'm@x.io');

  clearRememberedEmail(storage);
  assert.equal(readRememberedEmail(storage), null);
});

test('a blank remembered email reads as nothing to pre-fill', () => {
  const storage = memoryStorage();
  storage.setItem(REMEMBER_EMAIL_KEY, '   ');
  assert.equal(readRememberedEmail(storage), null);
});
