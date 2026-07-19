import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { BraceletLogo } from '../components/BraceletLogo';
import { Copy, Check, ArrowRight } from 'lucide-react';

export default function PairingScreen() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const partnerCode = profile?.partner_code ?? '';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(partnerCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePair = async () => {
    if (!code.trim()) { setError("Enter your partner's code"); return; }
    setBusy(true);
    setError(null);

    const normalizedCode = code.trim().toUpperCase();
    console.log('Searching for partner code:', normalizedCode);

    try {
      // Query without any filters first to test RLS
      const { data: allProfiles, error: allErr } = await supabase
        .from('profiles')
        .select('id, partner_code, paired_with, email');

      if (allErr) {
        console.error('Error fetching all profiles:', allErr);
        setError('Permission error: ' + allErr.message);
        setBusy(false);
        return;
      }

      console.log('All accessible profiles:', allProfiles);
      const matchingProfile = allProfiles?.find(p => p.partner_code?.toUpperCase() === normalizedCode);
      
      if (!matchingProfile) {
        setError('No one has that code. Check the spelling and try again.');
        setBusy(false);
        return;
      }

      console.log('Found partner:', matchingProfile);

      if (matchingProfile.paired_with) { 
        setError('That person is already paired'); 
        setBusy(false); 
        return; 
      }
      
      if (matchingProfile.id === profile?.id) { 
        setError("That's your own code"); 
        setBusy(false); 
        return; 
      }

      // Update current user's paired_with
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ paired_with: matchingProfile.id })
        .eq('id', profile!.id);
        
      if (updateErr) { 
        console.error('Update error:', updateErr);
        setError('Error pairing: ' + updateErr.message); 
        setBusy(false); 
        return; 
      }

      // Update partner's paired_with
      const { error: partnerUpdateErr } = await supabase
        .from('profiles')
        .update({ paired_with: profile!.id })
        .eq('id', matchingProfile.id);
        
      if (partnerUpdateErr) {
        console.error('Partner update error:', partnerUpdateErr);
        setError('Error completing pair: ' + partnerUpdateErr.message);
        setBusy(false);
        return;
      }

      console.log('Pairing successful!');
      await refreshProfile();
      setBusy(false);
      navigate('/');
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Unexpected error. Try again.');
      setBusy(false);
    }
  };

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
          <h1 className="font-display text-display-sm text-ink-900">Pair with your partner</h1>
          <p className="mt-2 text-sm text-ink-500">Share your code, or enter theirs.</p>
        </div>

        <div className="mb-10 animate-slide-up">
          <p className="mb-3 text-center text-[13px] font-medium text-ink-400 uppercase tracking-wider">Your code</p>
          <button
            onClick={handleCopy}
            disabled={!partnerCode}
            className="group relative mx-auto block w-full rounded-2xl bg-white p-6 shadow-lift transition-all duration-300 hover:shadow-float active:scale-[0.98]"
          >
            <div className="text-center font-mono text-3xl tracking-[0.4em] text-ink-900 font-semibold">
              {partnerCode || '------'}
            </div>
            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink-400 transition-colors group-hover:text-brand-500">
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Tap to copy'}
            </div>
          </button>
        </div>

        <div className="mb-8 flex items-center gap-4">
          <div className="h-px flex-1 bg-ink-200" />
          <span className="text-xs text-ink-400">or</span>
          <div className="h-px flex-1 bg-ink-200" />
        </div>

        <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <label className="label" htmlFor="partner-code">Partner's code</label>
          <input
            id="partner-code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="input text-center font-mono text-lg tracking-[0.25em]"
            placeholder="ENTER CODE"
            maxLength={6}
            onKeyDown={(e) => e.key === 'Enter' && !busy && handlePair()}
          />
        </div>

        {error && <p className="mt-4 rounded-xl bg-error-50 px-4 py-3 text-sm text-error-600 animate-scale-in">{error}</p>}

        <button onClick={handlePair} disabled={busy} className="btn-primary mt-6 w-full py-3.5 group">
          {busy ? 'Connecting...' : 'Pair up'}
          {!busy && <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />}
        </button>
      </div>
    </div>
  );
}
