import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, X, Check, Shuffle, Flame } from 'lucide-react';

type TDState = { turn?: string; promptType?: 'truth' | 'dare' | null; prompt?: string | null; mode?: string; penalty?: string | null };
type ToTState = { optionA?: string; optionB?: string; picks?: Record<string, 'a' | 'b'> };
type Tab = 'truth_or_dare' | 'this_or_that';

export default function GamesScreen() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('truth_or_dare');
  const [tdState, setTdState] = useState<TDState>({});
  const [totState, setTotState] = useState<ToTState>({});
  const [busy, setBusy] = useState(false);

  const partnerId = profile?.paired_with ?? '';
  const myTurn = !tdState.turn || tdState.turn === profile?.id;

  const loadState = useCallback(async () => {
    if (!profile?.id) return;
    const sorted = [profile.id, partnerId].sort();
    const { data } = await supabase.from('game_sessions').select('game_type, state').eq('user_a', sorted[0]).eq('user_b', sorted[1]);
    for (const row of data ?? []) {
      if (row.game_type === 'truth_or_dare') setTdState(row.state ?? {});
      if (row.game_type === 'this_or_that') setTotState(row.state ?? {});
    }
  }, [profile?.id, partnerId]);

  useEffect(() => { loadState(); }, [loadState]);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase.channel('game-sessions').on('postgres_changes', { event: '*', schema: 'public', table: 'game_sessions' }, loadState).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, loadState]);

  const spin = async (choice: 'truth' | 'dare') => {
    setBusy(true);
    const { data } = await supabase.rpc('td_spin', { choice });
    if (data?.state) setTdState(data.state);
    setBusy(false);
  };

  const resolve = async (result: 'done' | 'skipped') => {
    setBusy(true);
    const { data } = await supabase.rpc('td_resolve', { result });
    if (data?.state) setTdState(data.state);
    setBusy(false);
  };

  const newRound = async () => {
    setBusy(true);
    const { data } = await supabase.rpc('tot_new_round');
    if (data?.state) setTotState(data.state);
    setBusy(false);
  };

  const pick = async (choice: 'a' | 'b') => {
    setBusy(true);
    const { data } = await supabase.rpc('tot_pick', { choice });
    if (data?.state) setTotState(data.state);
    setBusy(false);
  };

  const myPick = profile?.id ? totState.picks?.[profile.id] : undefined;
  const partnerPick = partnerId ? totState.picks?.[partnerId] : undefined;
  const bothPicked = !!myPick && !!partnerPick;

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate('/')} className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface shadow-soft"><ArrowLeft size={16} /></button>
        <h1 className="font-display text-display-sm text-ink-900">Games</h1>
      </div>

      <div className="mb-6 flex gap-2 rounded-2xl bg-surface p-1.5 shadow-soft">
        <button onClick={() => setTab('truth_or_dare')} className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors ${tab === 'truth_or_dare' ? 'bg-brand-500 text-white' : 'text-ink-500'}`}>Truth or Dare</button>
        <button onClick={() => setTab('this_or_that')} className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors ${tab === 'this_or_that' ? 'bg-brand-500 text-white' : 'text-ink-500'}`}>This or That</button>
      </div>

      {tab === 'truth_or_dare' && (
        <div className="space-y-4 animate-fade-in">
          {tdState.penalty && tdState.mode === 'idle' && (
            <div className="rounded-2xl bg-error-50 p-4 animate-scale-in">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-error-600"><Flame size={13} /> Penalty</p>
              <p className="mt-1 text-sm text-ink-700">{tdState.penalty}</p>
            </div>
          )}

          {tdState.mode === 'prompted' && tdState.prompt ? (
            <div className="rounded-3xl bg-gradient-to-br from-brand-50 to-accent-50/40 p-6 shadow-soft animate-scale-in">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-500">{tdState.promptType}</p>
              <p className="font-display text-lg leading-snug text-ink-900 text-balance">{tdState.prompt}</p>
              {myTurn ? (
                <div className="mt-5 flex gap-2">
                  <button onClick={() => resolve('done')} disabled={busy} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-ink-900 py-3 text-sm font-medium text-white">
                    <Check size={16} /> Done it
                  </button>
                  <button onClick={() => resolve('skipped')} disabled={busy} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-surface py-3 text-sm font-medium text-ink-500 shadow-soft">
                    <X size={16} /> Skip (penalty)
                  </button>
                </div>
              ) : (
                <p className="mt-4 text-sm text-ink-500">Waiting for your partner to answer...</p>
              )}
            </div>
          ) : (
            <div className="rounded-3xl bg-surface p-6 text-center shadow-soft">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
                <Sparkles size={22} />
              </div>
              <p className="mb-5 text-sm text-ink-500">
                {myTurn ? "It's your turn — pick one" : "Waiting for your partner to pick..."}
              </p>
              {myTurn && (
                <div className="flex gap-3">
                  <button onClick={() => spin('truth')} disabled={busy} className="btn-primary flex-1 py-3">Truth</button>
                  <button onClick={() => spin('dare')} disabled={busy} className="flex-1 rounded-xl bg-accent-500 py-3 text-sm font-semibold text-white transition-transform active:scale-95">Dare</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'this_or_that' && (
        <div className="space-y-4 animate-fade-in">
          {totState.optionA && totState.optionB ? (
            <div className="rounded-3xl bg-surface p-6 shadow-soft">
              {!myPick ? (
                <>
                  <p className="mb-4 text-center text-sm text-ink-500">Pick one — no overthinking it</p>
                  <div className="flex gap-3">
                    <button onClick={() => pick('a')} disabled={busy} className="flex-1 rounded-2xl bg-brand-50 p-4 text-sm font-medium text-brand-700 transition-transform active:scale-95">{totState.optionA}</button>
                    <button onClick={() => pick('b')} disabled={busy} className="flex-1 rounded-2xl bg-accent-50 p-4 text-sm font-medium text-accent-700 transition-transform active:scale-95">{totState.optionB}</button>
                  </div>
                </>
              ) : !bothPicked ? (
                <p className="text-center text-sm text-ink-500">You picked <b>{myPick === 'a' ? totState.optionA : totState.optionB}</b> — waiting on your partner...</p>
              ) : (
                <div className="space-y-3 animate-scale-in">
                  <p className="text-center text-sm font-medium text-ink-700">
                    {myPick === partnerPick ? "You matched! 🎉" : "You picked differently 👀"}
                  </p>
                  <div className="flex gap-3 text-center text-sm">
                    <div className="flex-1 rounded-2xl bg-ink-50 p-3">
                      <p className="text-xs text-ink-400">You</p>
                      <p className="mt-1 font-medium text-ink-800">{myPick === 'a' ? totState.optionA : totState.optionB}</p>
                    </div>
                    <div className="flex-1 rounded-2xl bg-ink-50 p-3">
                      <p className="text-xs text-ink-400">Partner</p>
                      <p className="mt-1 font-medium text-ink-800">{partnerPick === 'a' ? totState.optionA : totState.optionB}</p>
                    </div>
                  </div>
                  <button onClick={newRound} disabled={busy} className="btn-primary flex w-full items-center justify-center gap-1.5 py-3">
                    <Shuffle size={16} /> Next round
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-3xl bg-surface p-6 text-center shadow-soft">
              <p className="mb-5 text-sm text-ink-500">Quick-fire choices, see how well you match.</p>
              <button onClick={newRound} disabled={busy} className="btn-primary w-full py-3">Start a round</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
