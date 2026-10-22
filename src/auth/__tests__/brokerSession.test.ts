import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BROKER_STORAGE_KEY,
  createBrokerSession,
  readBrokerSession,
  writeBrokerSession,
  clearBrokerSession,
} from '../brokerSession';

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

test('broker metadata never creates a frontend expiry deadline', () => {
  const session = createBrokerSession({ brokerId: '7', email: 'b@x.io', referenceCode: 'RC-1' });
  assert.equal('expiresAt' in session, false);
  assert.equal('idleExpiresAt' in session, false);
});

test('readBrokerSession round-trips a written session', () => {
  const storage = memoryStorage();
  const s = createBrokerSession({ brokerId: '7', email: 'b@x.io', referenceCode: 'RC-1' });
  writeBrokerSession(s, storage);
  assert.deepEqual(readBrokerSession(storage), s);
});

test('readBrokerSession returns null for missing, malformed, or wrong-shaped data', () => {
  const storage = memoryStorage();
  assert.equal(readBrokerSession(storage), null);

  storage.setItem(BROKER_STORAGE_KEY, 'not json');
  assert.equal(readBrokerSession(storage), null);

  // no referenceCode
  storage.setItem(BROKER_STORAGE_KEY, JSON.stringify({ brokerId: '7', email: 'b@x.io', expiresAt: 1, idleExpiresAt: 1 }));
  assert.equal(readBrokerSession(storage), null);

  // no brokerId
  storage.setItem(BROKER_STORAGE_KEY, JSON.stringify({ email: 'b@x.io', referenceCode: 'RC', expiresAt: 1, idleExpiresAt: 1 }));
  assert.equal(readBrokerSession(storage), null);
});

test('broker metadata is read back whatever the clock says', (t) => {
  const storage = memoryStorage();
  const metadata = { brokerId: '7', email: 'b@x.io', referenceCode: 'RC-1' };
  storage.setItem(BROKER_STORAGE_KEY, JSON.stringify(metadata));
  t.mock.method(Date, 'now', () => 24 * 60 * 60 * 1000);
  assert.deepEqual(readBrokerSession(storage), metadata);
  assert.notEqual(storage.getItem(BROKER_STORAGE_KEY), null);
});

test('clearBrokerSession removes the stored session', () => {
  const storage = memoryStorage();
  writeBrokerSession(createBrokerSession({ brokerId: '7', email: 'b@x.io', referenceCode: 'RC-1' }), storage);
  clearBrokerSession(storage);
  assert.equal(storage.getItem(BROKER_STORAGE_KEY), null);
});
