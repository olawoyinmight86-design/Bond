import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../lib/auth';
import { supabase, cacheGet, type Profile } from '../lib/supabase';
import { format } from 'date-fns';
import { Send, Mic, Image as ImageIcon, PenTool, Clock, CheckCheck, ChevronUp, MessageSquareText, Reply, X as XIcon } from 'lucide-react';
import { useOnlineStatus } from '../lib/useOnlineStatus';
import { composeMessage, onQueueChange } from '../lib/syncEngine';
import { setBadgeCount } from '../lib/badge';
import { getLocalMessages, getOutbox, cacheLocalMessage, type LocalMessage } from '../lib/offlineDB';
import { compressImage } from '../lib/imageCompress';
import { buildSmsFallbackLink, STUCK_THRESHOLD_ATTEMPTS } from '../lib/smsFallback';
import VoiceRecorder from '../components/VoiceRecorder';
import DrawPad from '../components/DrawPad';

type Mode = 'text' | 'voice' | 'draw';
const PAGE_SIZE = 40;
const QUICK_REACTIONS = ['❤️', '😂', '😮', '🥺', '👍'];

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
  const [partnerPhone, setPartnerPhone] = useState<string | null>(null);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [stuckCount, setStuckCount] = useState(0);
  const [replyingTo, setReplyingTo] = useState<{ preview: string; senderId: string } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const lastTypingSentRef = useRef(0);

  const partnerId = profile?.paired_with ?? '';

  const loadLocal = useCallback(async () => {
    const local = await getLocalMessages();
    setMessages(local);
  }, []);

  useEffect(() => { loadLocal(); }, [loadLocal]);
  useEffect(() => {
    const unsubscribe = onQueueChange(loadLocal);
    return () => { unsubscribe(); };
  }, [loadLocal]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  // Watch for anything stuck offline too long — signal we might have cell
  // signal but no data, and offer the SMS fallback.
  useEffect(() => {
    const checkStuck = async () => {
      const outbox = await getOutbox();
      setStuckCount(outbox.filter((o) => o.type === 'text' && o.attempts >= STUCK_THRESHOLD_ATTEMPTS).length);
    };
    checkStuck();
    const unsubscribe = onQueueChange(checkStuck);
    const interval = setInterval(checkStuck, 15_000);
    return () => { unsubscribe(); clearInterval(interval); };
  }, []);

  const syncFromServer = useCallback(async () => {
    if (!profile?.id || !partnerId || !online) return;
    try {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      const rows = (data ?? []).reverse();
      setHasMoreHistory(rows.length === PAGE_SIZE);

      for (const row of rows as any[]) {
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
          read_at: row.read_at,
          reactions: row.reactions ?? {},
          replyToPreview: row.reply_to_preview ?? undefined,
          replyToSenderId: row.reply_to_sender_id ?? undefined,
        });
      }
      await loadLocal();

      const { data: partner } = await supabase.from('profiles').select('display_name, phone_number').eq('id', partnerId).maybeSingle();
      if (partner?.display_name) setPartnerName(partner.display_name);
      setPartnerPhone(partner?.phone_number ?? null);
    } catch {
      // offline — local cache already has everything we've seen before
    }
  }, [profile?.id, partnerId, online, loadLocal]);

  useEffect(() => { syncFromServer(); }, [syncFromServer]);

  // Load an older page of history on demand, so the chat opens instantly
  // instead of always pulling your entire history every time.
  const loadEarlier = async () => {
    if (!profile?.id || !partnerId || !online || loadingMore) return;
    const oldest = messages[0]?.created_at;
    if (!oldest) return;
    setLoadingMore(true);
    try {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`)
        .lt('created_at', oldest)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      const rows = (data ?? []).reverse();
      setHasMoreHistory(rows.length === PAGE_SIZE);
      for (const row of rows as any[]) {
        let media_url: string | undefined;
        if (row.media_path) {
          const { data: signed } = await supabase.storage.from('chat-media').createSignedUrl(row.media_path, 60 * 60 * 24 * 7);
          media_url = signed?.signedUrl;
        }
        await cacheLocalMessage({
          id: row.id, client_id: row.client_id ?? row.id, sender_id: row.sender_id, recipient_id: row.recipient_id,
          type: row.type ?? 'text', content: row.content ?? '', media_url, duration_ms: row.duration_ms,
          created_at: row.created_at, pending: false, read_at: row.read_at, reactions: row.reactions ?? {},
          replyToPreview: row.reply_to_preview ?? undefined, replyToSenderId: row.reply_to_sender_id ?? undefined,
        });
      }
      await loadLocal();
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!profile?.id || !partnerId || !online) return;
    supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', profile.id)
      .eq('sender_id', partnerId)
      .is('read_at', null)
      .then(() => { setBadgeCount(0); });
  }, [profile?.id, partnerId, online, messages.length]);

  useEffect(() => {
    if (!profile?.id || !online) return;
    const channel = supabase.channel('messages-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
      syncFromServer();
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, online, syncFromServer]);

  // Typing indicator — ephemeral, never touches the database.
  useEffect(() => {
    if (!profile?.id || !partnerId || !online) return;
    const pairKey = [profile.id, partnerId].sort().join('-');
    const channel = supabase.channel(`typing-${pairKey}`, { config: { broadcast: { self: false } } });
    channel.on('broadcast', { event: 'typing' }, () => {
      setPartnerTyping(true);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = window.setTimeout(() => setPartnerTyping(false), 3000);
    }).subscribe();
    typingChannelRef.current = channel;
    return () => { supabase.removeChannel(channel); typingChannelRef.current = null; };
  }, [profile?.id, partnerId, online]);

  const notifyTyping = () => {
    if (!online || !typingChannelRef.current) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 2000) return; // throttle
    lastTypingSentRef.current = now;
    typingChannelRef.current.send({ type: 'broadcast', event: 'typing', payload: {} });
  };

  const previewFor = (msg: LocalMessage) => {
    if (msg.type === 'photo') return '📷 Photo';
    if (msg.type === 'voice') return '🎙️ Voice note';
    if (msg.type === 'drawing') return '✍️ Drawing';
    return msg.content.length > 80 ? msg.content.slice(0, 80) + '…' : msg.content;
  };

  const send = async (payload: { type: 'text' | 'photo' | 'voice' | 'drawing'; content?: string; mediaBlob?: Blob; mediaMime?: string; durationMs?: number }) => {
    if (!profile?.id || !partnerId) return;
    await composeMessage({
      senderId: profile.id, recipientId: partnerId, ...payload,
      replyToPreview: replyingTo?.preview, replyToSenderId: replyingTo?.senderId,
    });
    setReplyingTo(null);
    setMode('text');
  };

  const handleSendText = () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput('');
    send({ type: 'text', content: text });
  };

  const handlePhotoPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const compressed = await compressImage(file);
    send({ type: 'photo', mediaBlob: compressed, mediaMime: 'image/jpeg' });
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    setReactionPickerFor(null);
    if (!online) return; // reactions need a live round trip — not worth queuing offline
    await supabase.rpc('toggle_reaction', { message_id: messageId, emoji });
    syncFromServer();
  };

  if (!profile) return null;

  let lastDate = '';

  return (
    <div className="flex h-[calc(100vh-13rem)] flex-col animate-fade-in">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-xl shadow-soft">💕</div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-lg text-ink-900">{partnerName}</h1>
          <p className="truncate text-xs text-ink-400">
            {partnerTyping ? <span className="text-brand-500 font-medium">typing...</span> : online ? 'Your private conversation' : "Offline — saved on your phone, sends the moment you're back"}
          </p>
        </div>
      </div>

      {stuckCount > 0 && partnerPhone && (
        <a
          href={buildSmsFallbackLink(partnerPhone, "Hey, I sent you a message on Bond but it's stuck — no internet on my end. Checking in via text!")}
          className="mb-3 flex items-center gap-2 rounded-xl bg-accent-50 px-4 py-2.5 text-xs font-medium text-accent-700 animate-slide-up"
        >
          <MessageSquareText size={14} />
          Message stuck with no internet — tap to send as a text instead
        </a>
      )}

      <div ref={listRef} className="chat-wallpaper flex-1 overflow-y-auto space-y-1 rounded-2xl p-2 no-scrollbar">
        {hasMoreHistory && messages.length > 0 && (
          <button onClick={loadEarlier} disabled={loadingMore || !online} className="mx-auto mb-3 flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[11px] font-medium text-ink-400 shadow-soft disabled:opacity-50">
            <ChevronUp size={12} />
            {loadingMore ? 'Loading...' : 'Load earlier messages'}
          </button>
        )}
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
            const reactionEntries = Object.entries(msg.reactions ?? {});

            return (
              <div key={msg.client_id}>
                {showDateSep && (
                  <div className="my-4 flex items-center justify-center">
                    <span className="rounded-full bg-ink-100 px-3 py-1 text-[11px] font-medium text-ink-400">{format(new Date(msg.created_at), 'MMM d')}</span>
                  </div>
                )}
                <div className={`flex ${own ? 'justify-end' : 'justify-start'} ${sameSender ? 'mt-0.5' : 'mt-2'}`}>
                  <div className="relative max-w-[75%]">
                    <button
                      onDoubleClick={() => !msg.pending && msg.id && setReactionPickerFor(reactionPickerFor === msg.client_id ? null : msg.client_id)}
                      onClick={() => reactionPickerFor === msg.client_id && setReactionPickerFor(null)}
                      className={`w-full px-4 py-2.5 text-left text-[15px] leading-relaxed transition-all ${own ? 'bg-brand-500 text-white rounded-2xl rounded-br-md' : 'bg-white text-ink-800 rounded-2xl rounded-bl-md shadow-soft'} ${sameSender ? (own ? 'rounded-br-sm' : 'rounded-bl-sm') : ''}`}
                    >
                      {msg.replyToPreview && (
                        <div className={`mb-1.5 rounded-lg border-l-2 px-2 py-1 text-xs ${own ? 'border-white/50 bg-white/10 text-white/80' : 'border-brand-300 bg-ink-50 text-ink-500'}`}>
                          <span className="font-medium">{msg.replyToSenderId === profile.id ? 'You' : partnerName}</span>
                          <p className="truncate">{msg.replyToPreview}</p>
                        </div>
                      )}
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
                        {own && !msg.pending && (
                          <CheckCheck size={12} className={msg.read_at ? 'text-white' : 'text-white/40'} />
                        )}
                      </div>
                    </button>

                    {reactionEntries.length > 0 && (
                      <div className={`absolute -bottom-3 ${own ? 'right-2' : 'left-2'} flex gap-0.5 rounded-full bg-white px-1.5 py-0.5 text-xs shadow-soft`}>
                        {reactionEntries.map(([uid, emoji]) => <span key={uid}>{emoji as string}</span>)}
                      </div>
                    )}

                    {reactionPickerFor === msg.client_id && msg.id && (
                      <div className={`absolute -top-11 ${own ? 'right-0' : 'left-0'} z-10 flex items-center gap-1 rounded-full bg-white px-2 py-1.5 shadow-float animate-scale-in`}>
                        {QUICK_REACTIONS.map((emoji) => (
                          <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)} className="text-lg transition-transform active:scale-125">
                            {emoji}
                          </button>
                        ))}
                        <div className="mx-0.5 h-5 w-px bg-ink-100" />
                        <button
                          onClick={() => { setReplyingTo({ preview: previewFor(msg), senderId: msg.sender_id }); setReactionPickerFor(null); }}
                          className="flex h-6 w-6 items-center justify-center text-ink-400 transition-transform active:scale-90"
                        >
                          <Reply size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-0 mt-4">
        {replyingTo && mode === 'text' && (
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-soft animate-slide-up">
            <Reply size={14} className="flex-shrink-0 text-brand-400" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-brand-500">Replying to {replyingTo.senderId === profile.id ? 'yourself' : partnerName}</p>
              <p className="truncate text-xs text-ink-500">{replyingTo.preview}</p>
            </div>
            <button onClick={() => setReplyingTo(null)} className="flex-shrink-0 text-ink-300"><XIcon size={16} /></button>
          </div>
        )}
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
              type="text" value={input}
              onChange={(e) => { setInput(e.target.value); notifyTyping(); }}
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
