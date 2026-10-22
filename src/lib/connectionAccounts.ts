import { POOL_URL, POOL_USERNAME_HINT } from './poolConnection';
import { downloadTextFile } from './csvDownload';
import type { DmndSession, Subaccount } from '@/api/types';
import { subaccountName } from './subaccountsTable';

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
