import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { BraceletLogo } from '../components/BraceletLogo';
import { Copy, Check, ArrowRight, Share2, PartyPopper } from 'lucide-react';

export default function PairingScreen() {
  const { profile, refreshProfile, user } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [justPaired, setJustPaired] = useState(false);

  const partnerCode = profile?.partner_code ?? '';

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('pairing-profile-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        () => { refreshProfile(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refreshProfile]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(partnerCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const message = `Let's connect on Bond 💕 My code is ${partnerCode} — download the app and enter it to pair with me!`;
    if (navigator.share) {
      try { await navigator.share({ text: message }); } catch { /* user cancelled — nothing to do */ }
    } else {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const friendlyError = (raw: string) => {
    if (raw.includes('No one has that code')) return "Hmm, that code doesn't match anyone yet — double check it, or ask your partner to resend it.";
    if (raw.includes('already paired')) return 'Looks like that code belongs to someone who already has a partner. If this is a mistake on your own account, you can reset it from Settings once you\'re in.';
    if (raw.includes('yourself')) return "That's your own code! Send it to your partner instead — they enter it, not you.";
    if (raw.includes('Not authenticated')) return 'Your session dropped — try logging in again.';
    return raw;
  };

  const handlePair = async () => {
    if (!code.trim()) { setError("Enter your partner's code first 💛"); return; }
    if (!user?.id) { setError('Not logged in'); return; }
    if (!profile?.id) { setError('Still loading your profile — one second and try again'); return; }

    setBusy(true);
    setError(null);

    const normalizedCode = code.trim().toUpperCase();

    try {
      const { data, error: rpcErr } = await supabase.rpc('pair_with_code', {
        input_code: normalizedCode,
      });

      if (rpcErr) {
        setError(friendlyError(rpcErr.message));
        setBusy(false);
        return;
      }

      if (!data?.success) {
        setError(friendlyError(data?.error ?? 'Could not pair. Try again.'));
        setBusy(false);
        return;
      }

      await refreshProfile();
      setJustPaired(true);
      setTimeout(() => navigate('/'), 1400);
    } catch {
      setError("Couldn't reach the server — check your connection and try again.");
      setBusy(false);
    }
  };

  if (justPaired) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-ink-50 px-6 text-center animate-fade-in">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-500 animate-scale-in">
          <PartyPopper size={28} />
        </div>
        <h1 className="font-display text-display-sm text-ink-900">You're paired! 🎉</h1>
        <p className="mt-2 text-sm text-ink-500">Taking you home...</p>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-ink-50 px-6">
      <div className="pointer-events-none absolute top-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-100/20 blur-3xl" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-10 flex items-center justify-center gap-2 animate-fade-in">
          <span className="h-1.5 w-8 rounded-full bg-brand-500" />
          <span className="h-1.5 w-8 rounded-full bg-brand-500" />
        </div>

        <div className="mb-8 text-center animate-fade-in">
          <BraceletLogo className="mx-auto mb-4 h-14 w-14" glow />
          <h1 className="font-display text-display-sm text-ink-900">One step from connected</h1>
          <p className="mt-2 text-sm text-ink-500">Send your partner your code, or pop theirs in below.</p>
        </div>

        <div className="mb-6 animate-slide-up">
          <p className="mb-3 text-center text-[13px] font-medium text-ink-400 uppercase tracking-wider">Your code</p>
          <div className="rounded-2xl bg-surface p-6 shadow-lift">
            <div className="text-center font-mono text-3xl tracking-[0.4em] text-ink-900 font-semibold">
              {partnerCode || '------'}
            </div>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                onClick={handleCopy}
                disabled={!partnerCode}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-ink-50 py-2.5 text-xs font-medium text-ink-600 transition-colors active:bg-ink-100"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={handleShare}
                disabled={!partnerCode}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand-50 py-2.5 text-xs font-medium text-brand-600 transition-colors active:bg-brand-100"
              >
                <Share2 size={14} />
                Send it
              </button>
            </div>
          </div>
          <p className="mt-2 text-center text-xs text-ink-400">Tip: "Send it" is the easiest way — no typos, no mix-ups.</p>
        </div>

        <div className="mb-6 flex items-center gap-4">
          <div className="h-px flex-1 bg-ink-200" />
          <span className="text-xs text-ink-400">or enter theirs</span>
          <div className="h-px flex-1 bg-ink-200" />
        </div>

        <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <input
            id="partner-code"
            type="text"
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); if (error) setError(null); }}
            className="input text-center font-mono text-lg tracking-[0.25em]"
            placeholder="ENTER THEIR CODE"
            maxLength={6}
            onKeyDown={(e) => e.key === 'Enter' && !busy && handlePair()}
          />
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-error-50 px-4 py-3 text-sm leading-relaxed text-error-600 animate-scale-in">
            {error}
          </p>
        )}

        <button onClick={handlePair} disabled={busy} className="btn-primary mt-6 w-full py-3.5 group">
          {busy ? 'Connecting...' : 'Pair up'}
          {!busy && <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />}
        </button>
      </div>
    </div>
  );
}
