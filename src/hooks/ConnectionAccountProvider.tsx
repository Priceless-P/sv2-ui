import { createContext, useContext, useState, type ReactNode } from 'react';
import { useAuth } from '@/auth';
import { useAccountProfile } from './useAccountData';
import { usePermissions, useSubaccountList } from './useSubaccounts';
import { useAggregatedModeContext } from './AggregatedModeProvider';
import { isConnectionExportAllowed, resolveConnectionAccount, type ConnectionAccount } from '@/lib/connectionAccounts';
import { subaccountName } from '@/lib/subaccountsTable';
import { useQueryClient } from '@tanstack/react-query';
import { getUser } from '@/api';

interface ConnectionAccountContextValue {
  aggregated: boolean;
  selectedId: string | null;
  account: ConnectionAccount | null;
  accountName: string | null;
  options: { id: string; name: string }[];
  selectAccount: (id: string) => void;
  isLoading: boolean;
  isError: boolean;
  canExportOtherAccounts: boolean;
  currentId: string | null;
  currentName: string;
  loadExportAccounts: (targetId: string) => Promise<ConnectionAccount[]>;
}

const ConnectionAccountContext = createContext<ConnectionAccountContextValue | null>(null);

/** Share the setup target between the connection summary and guide without switching the dashboard account. */
export function ConnectionAccountProvider({ children }: { children: ReactNode }) {
  const { session, viewingAccountId } = useAuth();
  const queryClient = useQueryClient();
  const { aggregated } = useAggregatedModeContext();
  const profile = useAccountProfile();
  const permissions = usePermissions();
  const list = useSubaccountList();
  const currentId = viewingAccountId ?? session?.accountId ?? null;
  const scope = `${session?.accountId}:${currentId}:${aggregated}`;
  const [selection, setSelection] = useState<{ scope: string; id: string } | null>(null);
  const selectedId = aggregated ? (selection?.scope === scope ? selection.id : null) : currentId;
  const subaccounts = list.isSuccess ? list.data : [];
  const currentName = viewingAccountId
    ? subaccounts.find((subaccount) => subaccount.id === viewingAccountId)?.sub_account.trim() || 'Subaccount'
    : 'Main account';
  const needsProfile = selectedId === currentId;
  const isError = (needsProfile && profile.isError) || (aggregated && list.isError);
  const account = isError ? null : resolveConnectionAccount({
    aggregated, selectedId, currentId, currentName,
    profile: profile.isSuccess ? profile.data : undefined,
    subaccounts,
  });
  const canExportOtherAccounts = !viewingAccountId && permissions.isSuccess && permissions.data.view_sub_accounts === true;
  const loadExportAccounts = async (targetId: string): Promise<ConnectionAccount[]> => {
    if (!isConnectionExportAllowed(targetId, currentId, canExportOtherAccounts)) {
      throw new Error('Only the main account can export other accounts.');
    }
    if (targetId === currentId) {
      const current = await queryClient.fetchQuery({
        queryKey: ['account', 'profile', currentId],
        queryFn: ({ signal }) => getUser().checkAuth({ accountId: currentId!, signal }),
        staleTime: 5 * 60 * 1000,
        retry: false,
      });
      if (String(current.id) !== currentId) throw new Error('Unable to load the correct account details.');
      return [{ id: currentId, name: currentName, pplnsPassword: current.token, fppsPassword: current.fpps_token ?? null }];
    }
    const ownerId = session?.accountId;
    if (!ownerId) throw new Error('Please sign in again.');
    const [owner, subs] = await Promise.all([
      queryClient.fetchQuery({
        queryKey: ['account', 'profile', ownerId],
        queryFn: ({ signal }) => getUser().checkAuth({ accountId: ownerId, signal }),
        staleTime: 5 * 60 * 1000,
        retry: false,
      }),
      queryClient.fetchQuery({
        queryKey: ['account', 'subaccounts', 'list', ownerId],
        queryFn: ({ signal }) => getUser().getSubaccounts({ accountId: ownerId, signal }),
        staleTime: 5 * 60 * 1000,
        retry: false,
      }),
    ]);
    if (String(owner.id) !== ownerId) throw new Error('Unable to load the correct account details.');
    const accounts = [
      { id: ownerId, name: 'Main account', pplnsPassword: owner.token, fppsPassword: owner.fpps_token ?? null },
      ...subs.map((sub) => ({ id: sub.id, name: subaccountName(sub), pplnsPassword: sub.token, fppsPassword: sub.fpps_token })),
    ];
    if (targetId === 'all') return accounts;
    const target = accounts.find((item) => item.id === targetId);
    if (!target) throw new Error('Account details are unavailable.');
    return [target];
  };

  return <ConnectionAccountContext.Provider value={{
    aggregated, selectedId, account, accountName: account?.name ?? (aggregated ? null : currentName),
    options: [{ id: session?.accountId ?? '', name: 'Main account' }, ...subaccounts.map((subaccount) => ({ id: subaccount.id, name: subaccountName(subaccount) }))],
    selectAccount: (id) => setSelection(id ? { scope, id } : null),
    isLoading: (needsProfile && profile.isLoading) || (aggregated && list.isLoading),
    isError,
    canExportOtherAccounts, currentId, currentName, loadExportAccounts,
  }}>{children}</ConnectionAccountContext.Provider>;
}

export function useConnectionAccount() {
  const context = useContext(ConnectionAccountContext);
  if (!context) throw new Error('useConnectionAccount requires ConnectionAccountProvider');
  return context;
}
