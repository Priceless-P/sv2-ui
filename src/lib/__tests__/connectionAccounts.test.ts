import { POOL_URL, POOL_USERNAME_HINT } from '../poolConnection';
import { CONNECTION_SAFETY_WARNING, connectionDetailsToText } from '../connectionAccounts';
import assert from 'node:assert/strict';
import test from 'node:test';
import type { DmndSession, Subaccount } from '@/api/types';
import { isConnectionExportAllowed, resolveConnectionAccount } from '@/lib/connectionAccounts';

const profile: DmndSession = {
  id: 'owner', email: 'owner@example.com', company_name: 'Owner', company_primary_location: null, kyb_status: 'Approved',
  token: 'owner-pplns', fpps_token: 'owner-fpps', two_factor_secret: null, bitcoin_addresses: {},
};
const subaccounts: Subaccount[] = [
  { id: 'farm-a', sub_account: 'Farm A', token: 'farm-a-pplns', fpps_token: 'farm-a-fpps', hashrate: '0', bitcoin_addresses: {} },
  { id: 'farm-b', sub_account: 'Farm B', token: 'farm-b-pplns', fpps_token: null, hashrate: '0', bitcoin_addresses: {} },
];
const context = { currentId: 'owner', currentName: 'Main account', profile, subaccounts };

test('subaccount exports are restricted to the acting account, including stale all-account selections', () => {
  assert.equal(isConnectionExportAllowed('farm-a', 'farm-a', false), true);
  assert.equal(isConnectionExportAllowed('owner', 'farm-a', false), false);
  assert.equal(isConnectionExportAllowed('farm-b', 'farm-a', false), false);
  assert.equal(isConnectionExportAllowed('all', 'farm-a', false), false);
  assert.equal(isConnectionExportAllowed('all', 'owner', false), false);
});

test('confirmed main accounts may export an individual account or all accounts', () => {
  assert.equal(isConnectionExportAllowed('farm-a', 'owner', true), true);
  assert.equal(isConnectionExportAllowed('all', 'owner', true), true);
  assert.equal(isConnectionExportAllowed('all', null, true), false);
  assert.equal(isConnectionExportAllowed('', 'owner', true), false);
});

test('aggregate setup requires an explicit target instead of exposing main-account passwords by default', () => {
  assert.equal(resolveConnectionAccount({ ...context, aggregated: true, selectedId: null }), null);
  assert.equal(resolveConnectionAccount({ ...context, aggregated: true, selectedId: 'deleted-account' }), null);
});

test('aggregate setup uses only the chosen account credentials and label', () => {
  assert.deepEqual(resolveConnectionAccount({ ...context, aggregated: true, selectedId: 'farm-a' }), {
    id: 'farm-a', name: 'Farm A', pplnsPassword: 'farm-a-pplns', fppsPassword: 'farm-a-fpps',
  });
  assert.deepEqual(resolveConnectionAccount({ ...context, aggregated: true, selectedId: 'owner' }), {
    id: 'owner', name: 'Main account', pplnsPassword: 'owner-pplns', fppsPassword: 'owner-fpps',
  });
  assert.equal(resolveConnectionAccount({ ...context, aggregated: true, selectedId: 'farm-b' })?.fppsPassword, null);
});

test('single-account setup ignores aggregate selections and follows the current authenticated account', () => {
  const current = resolveConnectionAccount({ ...context, aggregated: false, selectedId: 'farm-a' });
  assert.equal(current?.id, 'owner');
  assert.equal(current?.pplnsPassword, 'owner-pplns');
  const subProfile = { ...profile, id: 'farm-a', token: 'current-sub-pplns', fpps_token: 'current-sub-fpps' };
  assert.deepEqual(resolveConnectionAccount({ ...context, aggregated: false, selectedId: 'owner', currentId: 'farm-a', currentName: 'Farm A', profile: subProfile }), {
    id: 'farm-a', name: 'Farm A', pplnsPassword: 'current-sub-pplns', fppsPassword: 'current-sub-fpps',
  });
});

test('a stale or missing profile never exposes credentials under another account label', () => {
  assert.equal(resolveConnectionAccount({ ...context, aggregated: false, selectedId: null, currentId: 'farm-a', currentName: 'Farm A' }), null);
  assert.equal(resolveConnectionAccount({ ...context, aggregated: true, selectedId: 'owner', profile: undefined }), null);
});

const main = { id: '1', name: 'Main account', pplnsPassword: 'main-pplns-secret', fppsPassword: 'main-fpps-secret' };
const sub = { id: '2', name: 'Farm A', pplnsPassword: 'sub-pplns-secret', fppsPassword: null };

test('single-account setup export includes its credentials, warning and connection instructions', () => {
  const content = connectionDetailsToText([sub]);
  assert.ok(content.includes(CONNECTION_SAFETY_WARNING));
  assert.ok(content.includes(POOL_URL));
  assert.ok(content.includes(POOL_USERNAME_HINT));
  assert.ok(content.includes('Account: "Farm A" (ID: 2)'));
  assert.ok(content.includes('PPLNS password: sub-pplns-secret'));
  assert.ok(content.includes('FPPS password: Not available'));
  assert.ok(!content.includes(main.pplnsPassword));
});

test('all-account setup export keeps each payout password with the correct account', () => {
  const content = connectionDetailsToText([main, sub]);
  assert.ok(content.includes('Account: "Main account" (ID: 1)\nPPLNS password: main-pplns-secret\nFPPS password: main-fpps-secret'));
  assert.ok(content.includes('Account: "Farm A" (ID: 2)\nPPLNS password: sub-pplns-secret\nFPPS password: Not available'));
});

test('exports fail rather than producing an empty or incomplete setup sheet', () => {
  assert.throws(() => connectionDetailsToText([]));
  assert.throws(() => connectionDetailsToText([main, { ...sub, pplnsPassword: '' }]));
});
