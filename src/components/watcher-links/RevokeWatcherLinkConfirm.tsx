import { OtpField } from '@/components/ui/input-otp';
import { authErrorMessage } from '@/components/auth/authError';
import { useState } from 'react';
import { LiCloseCircle, LiShieldWarning } from 'solar-icon-react/li';
import { BdShieldWarning } from 'solar-icon-react/bd';
import { useAccountProfile } from '@/hooks/useAccountData';
import { isAuthenticatorCodeError } from '@/api';

/**
 * The revoke confirmation. Revoking cannot be undone, so it is a deliberate second
 * step rather than an inline action. The confirm button guards against a double
 * click firing two deletes, and a failure keeps the panel open with a message
 * instead of silently closing as though it had worked.
 */
export function RevokeWatcherLinkConfirm({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: (totpToken?: string) => Promise<void>;
}) {
  const [totpToken, setTotpToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const profile = useAccountProfile();
  const [challenged, setChallenged] = useState(false);
  const twoFaEnabled = challenged || profile.data?.two_factor_secret === null;
  const canConfirm = profile.isSuccess && !busy && (!twoFaEnabled || totpToken.length === 6);

  const confirm = async () => {
    if (!canConfirm) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(twoFaEnabled ? totpToken : undefined);
    } catch (e) {
      if (isAuthenticatorCodeError(e)) setChallenged(true);
      setError(authErrorMessage(e, 'Enter the current 6-digit authenticator code to revoke this link.'));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[8px]" onClick={onCancel} aria-hidden />
      <div
        role="dialog"
        aria-label="Revoke watcher link"
        className="relative flex w-full max-w-[472px] flex-col rounded-bl-xl border-b border-l border-border bg-popover p-4 shadow-xl"
      >
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          className="self-end text-placeholder transition-colors hover:text-foreground"
        >
          <LiCloseCircle className="h-6 w-6" />
        </button>

        <div className="flex flex-col items-center px-2 text-center">
          <BdShieldWarning className="h-14 w-14 text-destructive" />
          <h2 className="mt-4 text-xl font-semibold text-foreground">Revoke watcher link?</h2>
          <p className="mt-2 text-sm text-body-alt">
            This watcher link will stop working immediately. Applications using it will no longer be able to access
            mining data.
          </p>

          <div className="mt-4 flex w-full items-center gap-2 rounded-2xl bg-warning/10 p-3 text-left">
            <LiShieldWarning className="h-5 w-5 shrink-0 text-warning" />
            <span className="text-sm text-body-alt">This action cannot be undone.</span>
          </div>

          {twoFaEnabled && <div className="mt-4 space-y-2 text-left">
            <p className="text-sm text-body-alt">Authenticator code</p>
            <OtpField value={totpToken} onChange={setTotpToken} disabled={busy} ariaLabel="Current authenticator code" />
          </div>}
          {profile.isLoading && <p className="mt-3 text-sm text-body-alt">Checking 2FA status...</p>}
          {profile.isError && <p className="mt-3 text-sm text-destructive">Unable to check 2FA status. <button type="button" className="underline" onClick={() => void profile.refetch()}>Retry</button></p>}
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

          <div className="mt-6 flex w-full items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!canConfirm}
              onClick={() => void confirm()}
              className="h-11 flex-[2] rounded-[32px] bg-destructive-strong px-6 text-base leading-6 text-destructive-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {busy ? 'Revoking...' : 'Revoke'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
