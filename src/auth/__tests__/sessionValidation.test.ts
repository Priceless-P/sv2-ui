import assert from 'node:assert/strict';
import test from 'node:test';

import { DmndApiError } from '@/api';
import { shouldEndSessionAfterValidation } from '../sessionValidation';

test('startup validation ends a session only for an authentication rejection', () => {
  assert.equal(shouldEndSessionAfterValidation(new DmndApiError('expired', 'unauthorized')), true);
  assert.equal(shouldEndSessionAfterValidation(new DmndApiError('temporarily unavailable', 'server')), false);
  assert.equal(shouldEndSessionAfterValidation(new DmndApiError('offline', 'network')), false);
  assert.equal(shouldEndSessionAfterValidation(new Error('unexpected response')), false);
});
