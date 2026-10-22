import { useId } from 'react';
import { useConnectionAccount } from '@/hooks/ConnectionAccountProvider';
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
