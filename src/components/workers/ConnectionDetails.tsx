import { useAuth } from '@/auth';
import { useAccountProfile } from '@/hooks/useAccountData';
import { usePermissions, useSubaccountList } from '@/hooks/useSubaccounts';
import { useAggregatedModeContext } from '@/hooks/AggregatedModeProvider';
import { useQueryClient } from '@tanstack/react-query';
import { getUser } from '@/api';
import type { DmndSession, Subaccount } from '@/api/types';
import { subaccountName } from '@/lib/subaccountsTable';
import { downloadTextFile } from '@/lib/utils';
import { createContext, useContext, useId, useState, type ReactNode } from 'react';
import { POOL_URL, POOL_USERNAME_HINT } from '@/lib/poolConnection';
import { CredentialRow } from '@/components/home/CredentialRow';

/** The pool credentials a miner points hardware at, sourced from the account.
 * Shared by the workers empty state and the Connect-worker modal. */
export function ConnectionDetails({ showTitle = false }: { showTitle?: boolean }) {
  const { account, accountName, aggregated } = useConnectionAccount();

  return (
    <div className="space-y-2">
      {showTitle && !aggregated && accountName && <h3 className="text-base font-semibold text-heading">Connect workers to {accountName}</h3>}
      <ConnectionAccountControl />
      {account && <div key={account.id} className="divide-y divide-border">
      <CredentialRow label="Pool URL" value={POOL_URL} hint="Point your miner's pool / stratum URL here." />
      <CredentialRow label="Username" value={POOL_USERNAME_HINT} copyable={false} />
      <CredentialRow label="PPLNS Password" value={account.pplnsPassword} secret />
      <CredentialRow label="FPPS Password" value={account.fppsPassword ?? 'Not available'} secret={!!account.fppsPassword} copyable={!!account.fppsPassword} />
      </div>}
    </div>
  );
}

/** The selected setup account is explicit even when the rest of the dashboard combines accounts. */
export function ConnectionAccountControl() {
  const { aggregated, selectedId, account, options, selectAccount, isLoading, isError } = useConnectionAccount();
  const id = useId();
  return <div className="space-y-1.5">
    {aggregated ? <>
      <label htmlFor={id} className="text-sm text-body-alt">Connect workers to</label>
      <select id={id} value={selectedId ?? ''} onChange={(event) => selectAccount(event.target.value)} disabled={isLoading && options.length <= 1}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
        <option value="">Select an account</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
    </> : null}
    {isError ? <p role="status" className="text-xs text-body-alt">Couldn&apos;t load connection details.</p>
      : !account && <p className="text-xs text-body-alt">{isLoading ? 'Loading connection details…' : 'Select an account to see its connection details.'}</p>}
  </div>;
}

export interface ConnectionAccount {
  id: string;
  name: string;
  pplnsPassword: string;
  fppsPassword: string | null;
}

/** Cross-account exports require an explicitly confirmed main-account scope. */
export function isConnectionExportAllowed(targetId: string, currentId: string | null, canExportOtherAccounts: boolean): boolean {
  return !!currentId && !!targetId && (targetId === currentId || canExportOtherAccounts);
}

/** A connection target never falls back to another account's credentials. */
export function resolveConnectionAccount({ aggregated, selectedId, currentId, currentName, profile, subaccounts }: {
  aggregated: boolean;
  selectedId: string | null;
  currentId: string | null;
  currentName: string;
  profile?: DmndSession;
  subaccounts: Subaccount[];
}): ConnectionAccount | null {
  const targetId = aggregated ? selectedId : currentId;
  if (!targetId) return null;
  if (targetId === currentId) {
    if (!profile || String(profile.id) !== currentId) return null;
    return { id: targetId, name: currentName, pplnsPassword: profile.token, fppsPassword: profile.fpps_token ?? null };
  }
  if (!aggregated) return null;
  const target = subaccounts.find((subaccount) => subaccount.id === targetId);
  return target ? { id: target.id, name: subaccountName(target), pplnsPassword: target.token, fppsPassword: target.fpps_token } : null;
}

export const CONNECTION_SAFETY_WARNING = 'Sensitive mining credentials. Keep these details safe and share only with people you trust to configure your miners.';

/** A human-readable setup sheet; deliberately excludes dashboard login credentials. */
export function connectionDetailsToText(accounts: ConnectionAccount[]): string {
  if (accounts.length === 0 || accounts.some((account) => !account.pplnsPassword)) {
    throw new Error('Connection details are unavailable. Please try again.');
  }
  return [
    'DMND worker connection details',
    CONNECTION_SAFETY_WARNING,
    `Pool URL: ${POOL_URL}`,
    `Username: ${POOL_USERNAME_HINT}`,
    'Use the password for your chosen payout mode. Only use FPPS if authorised.',
    ...accounts.map((account) => [
      `Account: ${JSON.stringify(account.name)} (ID: ${account.id})`,
      `PPLNS password: ${account.pplnsPassword}`,
      `FPPS password: ${account.fppsPassword || 'Not available'}`,
    ].join('\n')),
  ].join('\n\n') + '\n';
}

export function downloadConnectionDetails(content: string): void {
  downloadTextFile(content, 'dmnd-worker-connection-details.txt');
}

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
