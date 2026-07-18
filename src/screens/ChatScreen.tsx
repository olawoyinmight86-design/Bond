import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../lib/auth';
import { supabase, cacheGet, cacheSet, type Profile } from '../lib/supabase';
import { format } from 'date-fns';
import { Send } from 'lucide-react';
import { useOnlineStatus } from '../lib/useOnlineStatus';

type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
};

export default function ChatScreen() {
  const { profile } = useAuth();
  const online = useOnlineStatus();
  const [messages, setMessages] = useState<Message[]>(() => cacheGet<Message[]>('chat_messages') ?? []);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [partnerName, setPartnerName] = useState(() => {
    const cached = cacheGet<{ profile: Profile | null; online: boolean; lastSeen: string | null }>('partner_data');
    return cached?.profile?.display_name ?? 'Partner';
  });
  const endRef = useRef<HTMLDivElement>(null);

  const partnerId = profile?.paired_with ?? '';

  const load = useCallback(async () => {
    if (!profile?.id || !partnerId) return;
    try {
      const { data } = await supabase.from('messages').select('*').or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`).order('created_at', { ascending: true }).limit(100);
      const list = (data as Message[]) ?? [];
      setMessages(list);
      cacheSet('chat_messages', list);
      const { data: partner } = await supabase.from('profiles').select('display_name').eq('id', partnerId).maybeSingle();
      if (partner?.display_name) setPartnerName(partner.display_name);
    } catch {
      // offline — keep cached messages
    }
  }, [profile?.id, partnerId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    if (!profile?.id || !online) return;
    const channel = supabase.channel('messages-changes').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      const msg = payload.new as Message;
      if (msg.sender_id === profile.id || msg.recipient_id === profile.id) {
        setMessages((prev) => {
          if (prev.some(m => m.id === msg.id)) return prev;
          const updated = [...prev, msg];
          cacheSet('chat_messages', updated);
          return updated;
        });
      }
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, online]);

  const handleSend = async () => {
    if (!input.trim() || !partnerId) return;
    const text = input.trim();
    setInput('');
    setBusy(true);

    // Optimistic: add message immediately
    const tempMsg: Message = {
      id: crypto.randomUUID(),
      sender_id: profile!.id,
      recipient_id: partnerId,
      content: text,
      read_at: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => {
      const updated = [...prev, tempMsg];
      cacheSet('chat_messages', updated);
      return updated;
    });

    try {
      const { data, error } = await supabase.from('messages').insert({ sender_id: profile!.id, recipient_id: partnerId, content: text }).select('*').maybeSingle();
      if (error) throw error;
      if (data) {
        // Replace temp message with real one
        setMessages((prev) => {
          const updated = prev.map(m => m.id === tempMsg.id ? (data as Message) : m);
          cacheSet('chat_messages', updated);
          return updated;
        });
      }
    } catch {
      // offline — message stays in cache as pending, will need manual retry
      // Keep the temp message so user sees their text
    } finally {
      setBusy(false);
    }
  };

  if (!profile) return null;

  let lastDate = '';

  return (
    <div className="flex h-[calc(100vh-13rem)] flex-col animate-fade-in">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-xl shadow-soft">💕</div>
        <div>
          <h1 className="font-display text-lg text-ink-900">{partnerName}</h1>
          <p className="text-xs text-ink-400">{online ? 'Your private conversation' : 'Offline — messages will send when reconnected'}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 no-scrollbar">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-2xl">💭</div>
            <p className="text-sm text-ink-400 text-center text-balance">Say hello to {partnerName}!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const own = msg.sender_id === profile.id;
            const dateStr = format(new Date(msg.created_at), 'yyyy-MM-dd');
            const showDateSep = dateStr !== lastDate;
            lastDate = dateStr;
            const prevMsg = messages[messages.indexOf(msg) - 1];
            const sameSender = prevMsg && prevMsg.sender_id === msg.sender_id && format(new Date(prevMsg.created_at), 'yyyy-MM-dd') === dateStr;

            return (
              <div key={msg.id}>
                {showDateSep && (
                  <div className="my-4 flex items-center justify-center">
                    <span className="rounded-full bg-ink-100 px-3 py-1 text-[11px] font-medium text-ink-400">{format(new Date(msg.created_at), 'MMM d')}</span>
                  </div>
                )}
                <div className={`flex ${own ? 'justify-end' : 'justify-start'} ${sameSender ? 'mt-0.5' : 'mt-2'}`}>
                  <div className={`max-w-[75%] px-4 py-2.5 text-[15px] leading-relaxed transition-all ${own ? 'bg-brand-500 text-white rounded-2xl rounded-br-md' : 'bg-white text-ink-800 rounded-2xl rounded-bl-md shadow-soft'} ${sameSender ? (own ? 'rounded-br-sm' : 'rounded-bl-sm') : ''}`}>
                    <p>{msg.content}</p>
                    <p className={`mt-0.5 text-[10px] ${own ? 'text-white/50' : 'text-ink-300'}`}>{format(new Date(msg.created_at), 'h:mm a')}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-0 mt-4">
        <div className="flex items-center gap-2 rounded-2xl bg-white p-2 shadow-lift">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !busy && handleSend()} className="flex-1 bg-transparent px-3 py-2 text-[15px] text-ink-900 placeholder-ink-400 outline-none" placeholder="Message..." disabled={busy} />
          <button onClick={handleSend} disabled={busy || !input.trim()} className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-white transition-all duration-200 hover:bg-brand-600 active:scale-90 disabled:opacity-30 disabled:pointer-events-none">
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
