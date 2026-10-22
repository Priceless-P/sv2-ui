import { useWatcherHashrate, useWatcherGeneratedBtc, useWatcherTokenRevoked } from '@/hooks/useWatcherView';
import { isWatcherAccessDenied } from '@/lib/watcherQueries';
import { formatBtc, sumGenerated } from '@/lib/generatedBtcTable';
import { LiveHashrateCardView } from '@/components/home/LiveHashrateCard';

/** True when a query failed because the token does not grant that scope (or is invalid). */
function isUnauthorized(error: unknown): boolean {
  return isWatcherAccessDenied(error);
}

/**
 * One account's read-only summary inside the multiwatcher view. Which panels show is
 * driven by the link's enforcement mode; a panel whose token-only fetch is rejected
 * for lack of scope is quietly dropped, so the card never claims data it cannot read.
 */
export function MultiwatcherAccountCard({
  accountId,
  token,
  showHashrate,
  showGenerated,
}: {
  token: string;
  accountId: string;
  showHashrate: boolean;
  showGenerated: boolean;
}) {
  const revoked = useWatcherTokenRevoked(token);
  const hashrate = useWatcherHashrate(token, showHashrate && !revoked);
  const generated = useWatcherGeneratedBtc(token, showGenerated, accountId);

  const hashrateOk = showHashrate && !(hashrate.isError && isUnauthorized(hashrate.error));
  const generatedOk = showGenerated && !(generated.isError && isUnauthorized(generated.error));
  const totalBtc = sumGenerated(generated.data ?? []);

  if (revoked) return <p role="status">This Watcher link is no longer valid.</p>;

  return (
    <div className="space-y-4">
      {hashrateOk && (
        <LiveHashrateCardView
          data={hashrate.data}
          isLoading={hashrate.isLoading}
          isError={hashrate.isError && !isUnauthorized(hashrate.error)}
        />
      )}
      {generatedOk && (
        <div className="rounded-xl border border-border bg-card p-4">
          <span className="text-sm text-body-alt">Generated BTC</span>
          {generated.isLoading ? (
            <p className="mt-2 h-8 w-32 animate-pulse rounded bg-muted" />
          ) : (
            <p className="mt-2 font-mono text-2xl font-semibold text-heading">
              {formatBtc(totalBtc)}
              <span className="ml-1 text-base font-normal text-body-alt">BTC</span>
            </p>
          )}
          <p className="mt-1 text-xs text-body-alt">Generated under FPPS across the available days</p>
        </div>
      )}
    </div>
  );
}
