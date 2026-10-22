import { useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/auth';
import { DmndApiError, getUser, isAuthenticatorCodeError } from '@/api';
import { PasswordField } from '@/components/auth/PasswordField';
import { authErrorMessage } from '@/components/auth/authError';
import { MIN_PASSWORD_LENGTH } from '@/auth/passwordStrength';
import { useToast } from '@/components/ui/toast';
import { overlayContainer } from '@/lib/utils';
import { OtpField } from '@/components/ui/input-otp';

/** Changes the signed-in owner's password through the authenticated endpoint. */
export function ChangePasswordModal({ twoFaEnabled, onClose }: { twoFaEnabled: boolean; onClose: () => void }) {
  const { session, viewingAccountId } = useAuth();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [challenged, setChallenged] = useState(false);
  const [step, setStep] = useState<'password' | 'code'>('password');
  const requiresCode = twoFaEnabled || challenged;
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, saving]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || !session || viewingAccountId) return;
    if (password !== confirmation) { setError('Passwords do not match.'); return; }
    if (password.length < MIN_PASSWORD_LENGTH) { setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`); return; }
    if (requiresCode && step === 'password') {
      setError(null);
      setStep('code');
      return;
    }
    if (requiresCode && code.length !== 6) { setError('Enter your 6-digit authenticator code.'); return; }
    setSaving(true);
    setError(null);
    try {
      await getUser().updatePassword(current, password, requiresCode ? code : undefined, { accountId: session.accountId });
      toast({ type: 'success', message: 'Password changed' });
      onClose();
    } catch (cause) {
      if (isAuthenticatorCodeError(cause)) {
        setChallenged(true);
        setStep('code');
        setCode('');
        if (step === 'password') { setError(null); return; }
      }
      if (cause instanceof DmndApiError && cause.status === 401 && cause.message === 'Invalid email or password') {
        setStep('password');
        setCode('');
      }
      setError(cause instanceof DmndApiError && cause.status === 401 && cause.message === 'Invalid email or password'
        ? 'Current password is incorrect.'
        : authErrorMessage(cause, "Couldn't change your password. Please try again."));
    } finally { setSaving(false); }
  };
  return createPortal(<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/40" onClick={() => { if (!saving) onClose(); }} aria-hidden />
    <section role="dialog" aria-modal="true" aria-labelledby="change-password-title" className="relative w-full max-w-md rounded-2xl border border-border bg-popover p-6">
      <h2 id="change-password-title" className="text-lg font-semibold text-heading">Change password</h2>
      <form onSubmit={(event) => void submit(event)} className="mt-4 space-y-4">
        {step === 'password' ? <>
        <div className="space-y-1"><label htmlFor="current-password" className="text-sm text-body-alt">Current password</label>
          <PasswordField id="current-password" value={current} onChange={(event) => setCurrent(event.target.value)} autoComplete="current-password" required autoFocus disabled={saving} /></div>
        <div className="space-y-1"><label htmlFor="new-password" className="text-sm text-body-alt">New password</label>
          <PasswordField id="new-password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required disabled={saving} /></div>
        <div className="space-y-1"><label htmlFor="confirm-password" className="text-sm text-body-alt">Confirm new password</label>
          <PasswordField id="confirm-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" required disabled={saving} /></div>
        </> : <div className="space-y-3">
          <p className="text-sm text-body-alt">Enter the 6-digit code from your authenticator app to confirm your password change.</p>
          <OtpField value={code} onChange={(value) => { setCode(value.replace(/\D/g, '').slice(0, 6)); setError(null); }}
            ariaLabel="Authenticator code" autoFocus disabled={saving} error={!!error} />
        </div>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-full border border-border px-4 py-2 text-sm">Cancel</button>
          {step === 'code' && <button type="button" disabled={saving} onClick={() => { setStep('password'); setCode(''); setError(null); }} className="rounded-full border border-border px-4 py-2 text-sm">Back</button>}
          <button type="submit" disabled={saving || (step === 'code' && code.length !== 6)} className="rounded-full bg-[hsl(var(--btn))] px-4 py-2 text-sm text-[hsl(var(--btn-foreground))] disabled:opacity-50">{saving ? 'Saving…' : step === 'password' && requiresCode ? 'Next' : 'Change password'}</button>
        </div>
      </form>
    </section>
  </div>, overlayContainer());
}
