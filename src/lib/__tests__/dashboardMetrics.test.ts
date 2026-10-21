import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, type AuthContextValue } from '@/auth/AuthProvider';
import { createSession } from '@/auth/session';
import { WorkerStatCards } from '@/components/home/WorkerStatCards';

const auth: AuthContextValue = {
  session: createSession({
    accountId: 'miner',
    email: 'miner@example.com',
    company_name: null,
    company_primary_location: null,
    kyb_status: 'Approved',
  }),
  status: 'authenticated',
  signOutReason: null,
  viewingAccountId: null,
  viewingAccount: null,
  signIn: () => {},
  signOut: () => {},
  setViewingAccount: () => {},
};

function renderMetrics(client: QueryClient): string {
  return renderToStaticMarkup(createElement(QueryClientProvider, { client },
    createElement(AuthContext.Provider, { value: auth }, createElement(WorkerStatCards)),
  ));
}

test('home metrics keep an unfetched or failed roster distinct from an empty roster', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    assert.match(renderMetrics(client), /Worker statistics unavailable/);

    client.getQueryCache().build(client, {
      queryKey: ['account', 'workers-all', 'miner'],
    }).setState({ status: 'error', error: new Error('Roster unavailable'), fetchStatus: 'idle' });
    assert.match(renderMetrics(client), /Worker statistics unavailable/);

    client.setQueryData(['account', 'workers-all', 'miner'], []);
    const empty = renderMetrics(client);
    assert.match(empty, /Connected workers will appear here/);
    assert.doesNotMatch(empty, /Worker statistics unavailable/);
  } finally {
    client.clear();
  }
});
