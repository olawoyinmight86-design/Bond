import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { AVATAR_EMOJIS } from '../lib/emoji';
import { BraceletLogo } from '../components/BraceletLogo';
import { ArrowRight } from 'lucide-react';

export default function OnboardingScreen() {
  const { profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [emoji, setEmoji] = useState(profile?.avatar_emoji ?? AVATAR_EMOJIS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleComplete = async () => {
    if (!name.trim()) { setError('What should your partner call you?'); return; }
    setBusy(true);
    setError(null);
    const { error } = await updateProfile({ display_name: name.trim(), avatar_emoji: emoji, onboarding_complete: true });
    setBusy(false);
    if (error) { setError(error); return; }
    navigate('/');
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-ink-50 via-white to-brand-50/30 px-6">
      <div className="pointer-events-none absolute top-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-100/20 blur-3xl" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-10 flex items-center justify-center gap-2 animate-fade-in">
          <span className="h-1.5 w-8 rounded-full bg-brand-500" />
          <span className="h-1.5 w-8 rounded-full bg-ink-200" />
        </div>

        <div className="mb-8 text-center animate-fade-in">
          <BraceletLogo className="mx-auto mb-4 h-14 w-14" glow />
          <h1 className="font-display text-display-sm text-ink-900">Tell us about you</h1>
          <p className="mt-2 text-sm text-ink-500">This is how your partner will see you.</p>
        </div>

        <div className="space-y-8 animate-slide-up">
          <div>
            <label className="label" htmlFor="name">Your name</label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="What should they call you?"
              autoFocus
            />
          </div>

          <div>
            <span className="label">Choose your avatar</span>
            <div className="grid grid-cols-8 gap-2">
              {AVATAR_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={`flex aspect-square items-center justify-center rounded-xl text-2xl transition-all duration-200 ease-smooth ${
                    emoji === e ? 'bg-brand-100 ring-2 ring-brand-400 scale-110 shadow-soft' : 'bg-ink-100/60 hover:bg-ink-200/60 hover:scale-105'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="rounded-xl bg-error-50 px-4 py-3 text-sm text-error-600 animate-scale-in">{error}</p>}

          <button onClick={handleComplete} disabled={busy} className="btn-primary w-full py-3.5 group">
            {busy ? 'Saving...' : 'Continue'}
            {!busy && <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
