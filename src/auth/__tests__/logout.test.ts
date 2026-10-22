import assert from 'node:assert/strict';
import test from 'node:test';
import { DmndApiError } from '@/api/types';
import { revokeDashboardSessions } from '../logout';

test('logout revokes discovered and restored subaccount cookies before the owner, once each', async () => {
  const calls: string[] = [];
  const result = await revokeDashboardSessions({
    getSubaccounts: async () => [{ id: 'sub' }] as Awaited<ReturnType<import('@/api/types').DmndClient['getSubaccounts']>>,
    logout: async (options) => {
      calls.push(options!.accountId!);
      if (options!.accountId === 'missing') throw new DmndApiError('expired', 'unauthorized', 401);
    },
  }, 'owner', ['sub', 'missing', 'owner']);
  assert.equal(result, true);
  assert.equal(calls[calls.length - 1], 'owner');
  assert.deepEqual(calls.sort(), ['missing', 'owner', 'sub']);
  assert.equal(calls.length, 3);
});

test('a failed delegated logout or list read never prevents owner revocation', async () => {
  const calls: string[] = [];
  assert.equal(await revokeDashboardSessions({
    getSubaccounts: async () => { throw new Error('offline'); },
    logout: async (options) => {
      calls.push(options!.accountId!);
      if (options!.accountId === 'sub') throw new Error('offline');
    },
  }, 'owner', ['sub']), false);
  assert.deepEqual(calls, ['sub', 'owner']);
});
