import assert from 'node:assert/strict';
import test from 'node:test';

import { API_ERROR_MESSAGES, DmndApiError } from '@/api';
import { authErrorMessage } from '@/components/auth/authError';

test('authErrorMessage presents network and server failures without internal terminology', () => {
  const network = authErrorMessage(new DmndApiError('technical network detail', 'network'));
  const server = authErrorMessage(new DmndApiError('DMND server error (500)', 'server'));

  assert.equal(network, API_ERROR_MESSAGES.network);
  assert.equal(server, API_ERROR_MESSAGES.server);
  assert.doesNotMatch(`${network} ${server}`, /DMND|500|server error/i);
});

test('authErrorMessage preserves actionable validation and screen-specific authorization copy', () => {
  assert.equal(authErrorMessage(new DmndApiError('Add another word', 'other')), 'Add another word');
  assert.equal(
    authErrorMessage(new DmndApiError('internal auth detail', 'unauthorized'), 'Incorrect email or password.'),
    'Incorrect email or password.',
  );
});
