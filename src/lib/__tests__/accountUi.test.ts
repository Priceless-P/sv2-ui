import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContext, type AuthContextValue } from '@/auth/AuthProvider';
import { createSession } from '@/auth/session';
import { SecurityTab } from '@/components/settings/SecurityTab';
import { ToastProvider } from '@/components/ui/toast';
import { useAccountScope } from '@/hooks/useAccountScope';

function ScopeProbe() {
  const scope = useAccountScope();
  return createElement('span', null, JSON.stringify(scope));
}

test('permission controls deny access while loading, after denial, and inside a subaccount', () => {
  for (const state of ['loading', 'denied', 'main', 'subaccount']) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const viewingAccountId = state === 'subaccount' ? 'sub' : null;
    const auth: AuthContextValue = {
      session: createSession({ accountId: 'owner', email: 'owner@example.com', company_name: null, company_primary_location: null, kyb_status: 'Approved' }),
      viewingAccountId, viewingAccount: null, status: 'authenticated', signOutReason: null,
      signIn: () => {}, signOut: () => {}, setViewingAccount: () => {},
    };
    if (state !== 'loading') client.setQueryData(['account', 'permissions', viewingAccountId ?? 'owner'], {
      view_sub_accounts: state !== 'denied', edit_btc_address: state !== 'denied',
    });
    try {
      const html = renderToStaticMarkup(createElement(QueryClientProvider, { client },
        createElement(AuthContext.Provider, { value: auth }, createElement(ScopeProbe))));
      assert.ok(html.includes(`canViewSubaccounts&quot;:${state === 'main'}`));
      assert.ok(html.includes(`canEditBitcoinAddress&quot;:${state === 'main'}`));
    } finally { client.clear(); }
  }
});

test('change password is enabled for a loaded main account and disabled in a subaccount', () => {
  for (const { viewingAccountId, mainAccount } of [
    { viewingAccountId: null, mainAccount: true },
    { viewingAccountId: 'sub', mainAccount: false },
    { viewingAccountId: null, mainAccount: false },
  ]) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const session = createSession({ accountId: 'owner', email: 'owner@example.com', company_name: 'Acme Mining', company_primary_location: null, kyb_status: 'Approved' });
    const auth: AuthContextValue = {
      session, viewingAccountId, viewingAccount: null, status: 'authenticated', signOutReason: null,
      signIn: () => {}, signOut: () => {}, setViewingAccount: () => {},
    };
    const id = viewingAccountId ?? session.accountId;
    client.setQueryData(['account', 'profile', id], { id, two_factor_secret: null });
    client.setQueryData(['account', 'permissions', id], { view_sub_accounts: mainAccount });
    try {
      const html = renderToStaticMarkup(createElement(QueryClientProvider, { client },
        createElement(AuthContext.Provider, { value: auth }, createElement(ToastProvider, null, createElement(SecurityTab)))));
      const button = html.match(/<button[^>]*>Change password<\/button>/)?.[0];
      assert.ok(button);
      if (!mainAccount) assert.match(button, /disabled/);
      else assert.doesNotMatch(button, /disabled=""/);
    } finally { client.clear(); }
  }
});

