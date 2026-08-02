import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { BraceletLogo } from '../components/BraceletLogo';

export default function ResetPasswordScreen() {
  const { updatePassword, clearPasswordRecovery, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError('Password needs to be at least 6 characters.'); return; }
    if (password !== confirm) { setError("Those don't match — try again."); return; }

    setBusy(true);
    const { error } = await updatePassword(password);
    setBusy(false);

    if (error) { setError(error); return; }
    setDone(true);
    setTimeout(() => clearPasswordRecovery(), 1800);
  };

  if (done) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-ink-50 px-6 text-center animate-fade-in">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-500 animate-scale-in">
          ✓
        </div>
        <h1 className="font-display text-display-sm text-ink-900">Password updated</h1>
        <p className="mt-2 text-sm text-ink-500">Taking you back in...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-ink-50 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center animate-fade-in">
          <BraceletLogo className="mx-auto mb-4 h-14 w-14" glow />
          <h1 className="font-display text-display-sm text-ink-900">Set a new password</h1>
          <p className="mt-2 text-sm text-ink-500">Choose something you'll remember this time.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 animate-slide-up">
          <div>
            <label className="label" htmlFor="new-password">New password</label>
            <input id="new-password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="At least 6 characters" autoComplete="new-password" />
          </div>
          <div>
            <label className="label" htmlFor="confirm-password">Confirm password</label>
            <input id="confirm-password" type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input" placeholder="Type it again" autoComplete="new-password" />
          </div>

          {error && <p className="rounded-xl bg-error-50 px-4 py-3 text-sm text-error-600 animate-scale-in">{error}</p>}

          <button type="submit" disabled={busy} className="btn-primary w-full py-3.5">
            {busy ? 'Updating...' : 'Update password'}
          </button>
        </form>

        <button
          onClick={() => { clearPasswordRecovery(); signOut(); }}
          className="mt-6 w-full text-center text-sm text-ink-400"
        >
          Cancel and sign in normally
        </button>
      </div>
    </div>
  );
}
