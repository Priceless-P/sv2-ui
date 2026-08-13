import assert from 'node:assert/strict';
import test from 'node:test';

import { API_ERROR_MESSAGES, DmndApiError } from '@/api';
import { isTwoFactorRequiredError } from '../resetErrors';

test('isTwoFactorRequiredError is true only for the exact backend 2FA message', () => {
  assert.equal(isTwoFactorRequiredError(new DmndApiError('Invalid 2FA token', 'other')), true);
});

test('isTwoFactorRequiredError is false for near-misses and other failures', () => {
  // Strings the old regex matched are now correctly rejected (exact match only).
  assert.equal(isTwoFactorRequiredError(new DmndApiError('invalid-token', 'other')), false);
  assert.equal(isTwoFactorRequiredError(new DmndApiError('two-factor required', 'unauthorized')), false);
  assert.equal(isTwoFactorRequiredError(new DmndApiError('invalid 2fa token', 'other')), false); // case differs
  assert.equal(
    isTwoFactorRequiredError(new DmndApiError("This email doesn't have an account", 'other')),
    false,
  );
  assert.equal(isTwoFactorRequiredError(new DmndApiError(API_ERROR_MESSAGES.network, 'network')), false);
  assert.equal(isTwoFactorRequiredError(new Error('Invalid 2FA token')), false); // not a DmndApiError
  assert.equal(isTwoFactorRequiredError(null), false);
});
