import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../lib/auth';
import { supabase, cacheGet, type Profile } from '../lib/supabase';
import { format } from 'date-fns';
import { Send, Mic, Image as ImageIcon, PenTool, Clock } from 'lucide-react';
import { useOnlineStatus } from '../lib/useOnlineStatus';
import { composeMessage, onQueueChange } from '../lib/syncEngine';
import { getLocalMessages, cacheLocalMessage, type LocalMessage } from '../lib/offlineDB';
import VoiceRecorder from '../components/VoiceRecorder';
import DrawPad from '../components/DrawPad';

type Mode = 'text' | 'voice' | 'draw';

export default function ChatScreen() {
  const { profile } = useAuth();
  const online = useOnlineStatus();
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<Mode>('text');
  const [partnerName, setPartnerName] = useState(() => {
    const cached = cacheGet<{ profile: Profile | null }>('partner_data');
    return cached?.profile?.display_name ?? 'Partner';
  });
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const partnerId = profile?.paired_with ?? '';

  // Load everything from the local device instantly — zero network needed.
  const loadLocal = useCallback(async () => {
    const local = await getLocalMessages();
    setMessages(local);
  }, []);

  useEffect(() => { loadLocal(); }, [loadLocal]);
  useEffect(() => {
    const unsubscribe = onQueueChange(loadLocal);
    return () => { unsubscribe(); };
  }, [loadLocal]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // When online, pull anything the partner sent while we were away, and
  // mirror it into the local cache so it's there next time we're offline.
  const syncFromServer = useCallback(async () => {
    if (!profile?.id || !partnerId || !online) return;
    try {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`)
        .order('created_at', { ascending: true })
        .limit(200);

      for (const row of (data ?? []) as any[]) {
        let media_url: string | undefined;
        if (row.media_path) {
          const { data: signed } = await supabase.storage.from('chat-media').createSignedUrl(row.media_path, 60 * 60 * 24 * 7);
          media_url = signed?.signedUrl;
        }
        await cacheLocalMessage({
          id: row.id,
          client_id: row.client_id ?? row.id,
          sender_id: row.sender_id,
          recipient_id: row.recipient_id,
          type: row.type ?? 'text',
          content: row.content ?? '',
          media_url,
          duration_ms: row.duration_ms,
          created_at: row.created_at,
          pending: false,
        });
      }
      await loadLocal();

      const { data: partner } = await supabase.from('profiles').select('display_name').eq('id', partnerId).maybeSingle();
      if (partner?.display_name) setPartnerName(partner.display_name);
    } catch {
      // offline — local cache already has everything we've seen before
    }
  }, [profile?.id, partnerId, online, loadLocal]);

  useEffect(() => { syncFromServer(); }, [syncFromServer]);

  useEffect(() => {
    if (!profile?.id || !online) return;
    const channel = supabase.channel('messages-changes').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
      syncFromServer();
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, online, syncFromServer]);

  const send = async (payload: { type: 'text' | 'photo' | 'voice' | 'drawing'; content?: string; mediaBlob?: Blob; mediaMime?: string; durationMs?: number }) => {
    if (!profile?.id || !partnerId) return;
    await composeMessage({
      senderId: profile.id,
      recipientId: partnerId,
      ...payload,
    });
    setMode('text');
  };

  const handleSendText = () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');
    send({ type: 'text', content: text });
  };

  const handlePhotoPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) send({ type: 'photo', mediaBlob: file, mediaMime: file.type });
    e.target.value = '';
  };

  if (!profile) return null;

  let lastDate = '';

  return (
    <div className="flex h-[calc(100vh-13rem)] flex-col animate-fade-in">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-xl shadow-soft">💕</div>
        <div>
          <h1 className="font-display text-lg text-ink-900">{partnerName}</h1>
          <p className="text-xs text-ink-400">{online ? 'Your private conversation' : "Offline — it's saved on your phone and will deliver the moment you're back online"}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 no-scrollbar">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-2xl">💭</div>
            <p className="text-sm text-ink-400 text-center text-balance">Say hello to {partnerName}! Works even with no signal.</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const own = msg.sender_id === profile.id;
            const dateStr = format(new Date(msg.created_at), 'yyyy-MM-dd');
            const showDateSep = dateStr !== lastDate;
            lastDate = dateStr;
            const prevMsg = messages[i - 1];
            const sameSender = prevMsg && prevMsg.sender_id === msg.sender_id && format(new Date(prevMsg.created_at), 'yyyy-MM-dd') === dateStr;

            return (
              <div key={msg.client_id}>
                {showDateSep && (
                  <div className="my-4 flex items-center justify-center">
                    <span className="rounded-full bg-ink-100 px-3 py-1 text-[11px] font-medium text-ink-400">{format(new Date(msg.created_at), 'MMM d')}</span>
                  </div>
                )}
                <div className={`flex ${own ? 'justify-end' : 'justify-start'} ${sameSender ? 'mt-0.5' : 'mt-2'}`}>
                  <div className={`max-w-[75%] px-4 py-2.5 text-[15px] leading-relaxed transition-all ${own ? 'bg-brand-500 text-white rounded-2xl rounded-br-md' : 'bg-white text-ink-800 rounded-2xl rounded-bl-md shadow-soft'} ${sameSender ? (own ? 'rounded-br-sm' : 'rounded-bl-sm') : ''}`}>
                    {msg.type === 'text' && <p>{msg.content}</p>}
                    {msg.type === 'photo' && msg.media_url && (
                      <img src={msg.media_url} alt="Shared photo" className="max-h-64 rounded-xl object-cover" />
                    )}
                    {msg.type === 'voice' && msg.media_url && (
                      <audio controls src={msg.media_url} className="h-9 w-52" />
                    )}
                    {msg.type === 'drawing' && msg.media_url && (
                      <img src={msg.media_url} alt="Handwritten note" className="max-h-64 rounded-xl bg-white object-contain" />
                    )}
                    <div className={`mt-1 flex items-center gap-1 text-[10px] ${own ? 'text-white/50' : 'text-ink-300'}`}>
                      <span>{format(new Date(msg.created_at), 'h:mm a')}</span>
                      {msg.pending && <Clock size={10} />}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-0 mt-4">
        {mode === 'voice' && (
          <VoiceRecorder
            onSend={(blob, mime, durationMs) => send({ type: 'voice', mediaBlob: blob, mediaMime: mime, durationMs })}
            onCancel={() => setMode('text')}
          />
        )}
        {mode === 'draw' && (
          <DrawPad
            onSend={(blob) => send({ type: 'drawing', mediaBlob: blob, mediaMime: 'image/png' })}
            onCancel={() => setMode('text')}
          />
        )}
        {mode === 'text' && (
          <div className="flex items-center gap-1.5 rounded-2xl bg-white p-2 shadow-lift">
            <button onClick={() => fileInputRef.current?.click()} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-ink-400 active:scale-90 transition-transform">
              <ImageIcon size={19} />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoPicked} />
            <button onClick={() => setMode('draw')} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-ink-400 active:scale-90 transition-transform">
              <PenTool size={19} />
            </button>
            <input
              type="text" value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
              className="min-w-0 flex-1 bg-transparent px-2 py-2 text-[15px] text-ink-900 placeholder-ink-400 outline-none"
              placeholder="Message..."
            />
            {input.trim() ? (
              <button onClick={handleSendText} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white transition-all duration-200 active:scale-90">
                <Send size={18} />
              </button>
            ) : (
              <button onClick={() => setMode('voice')} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white transition-all duration-200 active:scale-90">
                <Mic size={18} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
