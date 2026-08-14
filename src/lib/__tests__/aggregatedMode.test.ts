import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGG_DEFAULTED_KEY,
  AGG_STORAGE_KEY,
  claimAggregatedDefault,
  loginMarker,
  readAggregated,
} from '../aggregatedMode';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  } as Storage;
}

test('AGG_STORAGE_KEY is the namespaced dashboard key', () => {
  assert.equal(AGG_STORAGE_KEY, 'dmnd.dashboard.aggregated');
});

test('readAggregated is true only for the exact "true" string', () => {
  assert.equal(readAggregated('true'), true);
});

test('readAggregated defaults to false for null, empty, or unknown values', () => {
  assert.equal(readAggregated(null), false);
  assert.equal(readAggregated(''), false);
  assert.equal(readAggregated('false'), false);
  assert.equal(readAggregated('1'), false);
  assert.equal(readAggregated('nonsense'), false);
});

test('AGG_DEFAULTED_KEY sits under the same dashboard namespace as the preference', () => {
  assert.equal(AGG_DEFAULTED_KEY, `${AGG_STORAGE_KEY}.defaulted`);
});

test('claimAggregatedDefault applies the default once, then never again for that login', () => {
  const storage = memoryStorage();
  const marker = loginMarker('master', 1_000);

  assert.equal(claimAggregatedDefault(marker, storage), true);
  assert.equal(claimAggregatedDefault(marker, storage), false, 'a refresh must not re-apply it');
  assert.equal(storage.getItem(AGG_DEFAULTED_KEY), marker);
});

test('claimAggregatedDefault re-applies for a different login in the same tab', () => {
  const storage = memoryStorage();
  claimAggregatedDefault(loginMarker('master', 1_000), storage);

  // A different account, and the same account signing in again (new expiry), both count
  // as a new login and get the default evaluated fresh.
  assert.equal(claimAggregatedDefault(loginMarker('other', 1_000), storage), true);
  assert.equal(claimAggregatedDefault(loginMarker('master', 2_000), storage), true);
});

test('claimAggregatedDefault claims the default when storage is missing or throws', () => {
  const blocked = {
    getItem: () => {
      throw new Error('storage disabled');
    },
    setItem: () => {},
    removeItem: () => {},
  } as unknown as Storage;

  assert.equal(claimAggregatedDefault(loginMarker('master', 1_000), null), true);
  assert.equal(claimAggregatedDefault(loginMarker('master', 1_000), blocked), true);
});
