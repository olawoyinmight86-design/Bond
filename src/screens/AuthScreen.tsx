import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { BraceletLogo } from '../components/BraceletLogo';
import { useOnlineStatus } from '../lib/useOnlineStatus';

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const online = useOnlineStatus();
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!online) { setError('You need an internet connection to sign in.'); return; }
    setError(null);
    setBusy(true);
    const fn = mode === 'signin' ? signIn : signUp;
    const { error } = await fn(email, password);
    setBusy(false);
    if (error) setError(error);
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-ink-50 px-6">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-brand-200/20 blur-3xl animate-pulse-soft" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-accent-200/15 blur-3xl animate-pulse-soft" style={{ animationDelay: '1s' }} />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-12 text-center animate-fade-in">
          <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center">
            <BraceletLogo className="h-20 w-20" glow />
          </div>
          <h1 className="font-display text-display text-ink-900 tracking-tight">Bond</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-500 text-balance">
            A private space for two.<br />Stay close, grow together.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 animate-slide-up">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="you@example.com" autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="At least 6 characters" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
          </div>

          {error && <p className="rounded-xl bg-error-50 px-4 py-3 text-sm text-error-600 animate-scale-in">{error}</p>}

          <button type="submit" disabled={busy || !online} className="btn-primary w-full py-3.5">
            {busy ? 'One moment...' : mode === 'signin' ? 'Welcome back' : 'Begin your bond'}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-ink-400 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          {mode === 'signin' ? (
            <>New here?{' '}<button onClick={() => { setMode('signup'); setError(null); }} className="font-medium text-brand-500 hover:text-brand-600 transition-colors">Create an account</button></>
          ) : (
            <>Already bonded?{' '}<button onClick={() => { setMode('signin'); setError(null); }} className="font-medium text-brand-500 hover:text-brand-600 transition-colors">Sign in</button></>
          )}
        </p>
      </div>
    </div>
  );
}
