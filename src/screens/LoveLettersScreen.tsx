import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, Feather, Lock, Mail } from 'lucide-react';

type Letter = { id: string; title: string; body: string | null; sealed: boolean; from_me: boolean; deliver_at: string; created_at: string };

export default function LoveLettersScreen() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [letters, setLetters] = useState<Letter[]>([]);
  const [writing, setWriting] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [deliverAt, setDeliverAt] = useState('');
  const [sending, setSending] = useState(false);
  const [openLetter, setOpenLetter] = useState<Letter | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('get_my_letters');
    setLetters((data ?? []) as Letter[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase.channel('love-letters').on('postgres_changes', { event: '*', schema: 'public', table: 'love_letters' }, load).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, load]);

  const send = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      await supabase.rpc('send_love_letter', {
        p_title: title.trim() || 'A letter for you',
        p_body: body.trim(),
        p_deliver_at: deliverAt ? new Date(deliverAt).toISOString() : new Date().toISOString(),
      });
      setTitle(''); setBody(''); setDeliverAt(''); setWriting(false);
      load();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate('/')} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-soft"><ArrowLeft size={16} /></button>
        <h1 className="font-display text-display-sm text-ink-900">Love Letters</h1>
      </div>

      {writing ? (
        <div className="space-y-3 rounded-3xl bg-white p-5 shadow-soft animate-scale-in">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" className="input py-2.5 text-sm" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write from the heart..." rows={8} className="input resize-none py-2.5 text-sm leading-relaxed" />
          <div>
            <label className="label">Deliver on (optional — leave blank to send now)</label>
            <input type="datetime-local" value={deliverAt} onChange={(e) => setDeliverAt(e.target.value)} className="input py-2.5 text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setWriting(false)} className="flex-1 rounded-xl bg-ink-50 py-3 text-sm font-medium text-ink-600">Cancel</button>
            <button onClick={send} disabled={sending || !body.trim()} className="btn-primary flex-1 py-3 disabled:opacity-40">
              {sending ? 'Sealing...' : deliverAt ? 'Seal & schedule' : 'Seal & send'}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setWriting(true)} className="mb-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 py-4 text-sm font-semibold text-white shadow-lift transition-transform active:scale-[0.98]">
          <Feather size={16} /> Write a letter
        </button>
      )}

      <div className="mt-5 space-y-3">
        {letters.length === 0 && !writing && (
          <p className="py-8 text-center text-sm text-ink-400">No letters yet — write the first one.</p>
        )}
        {letters.map((letter) => (
          <button
            key={letter.id}
            onClick={() => !letter.sealed && setOpenLetter(letter)}
            className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-soft transition-transform active:scale-[0.99]"
          >
            <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${letter.sealed ? 'bg-ink-100 text-ink-400' : 'bg-brand-50 text-brand-500'}`}>
              {letter.sealed ? <Lock size={17} /> : <Mail size={17} />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink-800">{letter.sealed ? 'Sealed letter' : letter.title}</p>
              <p className="text-xs text-ink-400">
                {letter.from_me ? 'From you' : 'For you'} · {letter.sealed ? `Opens ${format(new Date(letter.deliver_at), 'MMM d, h:mm a')}` : format(new Date(letter.created_at), 'MMM d, yyyy')}
              </p>
            </div>
          </button>
        ))}
      </div>

      {openLetter && (
        <>
          <div className="fixed inset-0 z-50 bg-ink-950/80 backdrop-blur-md animate-fade-in" onClick={() => setOpenLetter(null)} />
          <div className="fixed inset-x-4 top-1/2 z-50 -translate-y-1/2 animate-scale-in">
            <div className="max-h-[80vh] overflow-y-auto rounded-3xl bg-gradient-to-br from-brand-50 to-white p-6 shadow-float">
              <p className="mb-1 font-display text-xl text-ink-900">{openLetter.title}</p>
              <p className="mb-4 text-xs text-ink-400">{openLetter.from_me ? 'From you' : 'For you'} · {format(new Date(openLetter.created_at), 'MMM d, yyyy')}</p>
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink-800">{openLetter.body}</p>
              <button onClick={() => setOpenLetter(null)} className="btn-primary mt-6 w-full py-3">Close</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
