import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';
import { notifyIncomingMessage } from './localReminders';

export type Activity = 'idle' | 'typing' | 'recording' | 'in_booth' | 'in_games' | 'listening';

type PartnerActivityState = {
  partnerDraft: string;
  partnerActivity: Activity;
  partnerName: string;
  lastMessagePreview: { text: string; senderIsMe: boolean; at: number } | null;
  sendDraft: (text: string) => void;
  sendActivity: (activity: Activity) => void;
  dismissBubble: () => void;
  bubbleDismissedAt: number;
};

const Ctx = createContext<PartnerActivityState | null>(null);

const DRAFT_FADE_MS = 4000;
const DRAFT_DEBOUNCE_MS = 180;

export function PartnerActivityProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [partnerDraft, setPartnerDraft] = useState('');
  const [partnerActivity, setPartnerActivity] = useState<Activity>('idle');
  const [partnerName, setPartnerName] = useState('Partner');
  const partnerNameRef = useRef('Partner');
  const [lastMessagePreview, setLastMessagePreview] = useState<PartnerActivityState['lastMessagePreview']>(null);
  const [bubbleDismissedAt, setBubbleDismissedAt] = useState(0);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const draftTimerRef = useRef<number | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const sendDebounceRef = useRef<number | null>(null);

  const partnerId = profile?.paired_with ?? '';

  useEffect(() => {
    if (!profile?.id || !partnerId) return;
    const pairKey = [profile.id, partnerId].sort().join('-');
    const channel = supabase.channel(`activity-${pairKey}`, { config: { broadcast: { self: false } } });

    channel
      .on('broadcast', { event: 'draft' }, ({ payload }) => {
        setPartnerDraft(payload.text ?? '');
        setPartnerActivity(payload.text ? 'typing' : 'idle');
        if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
        if (payload.text) {
          fadeTimerRef.current = window.setTimeout(() => {
            setPartnerDraft('');
            setPartnerActivity('idle');
          }, DRAFT_FADE_MS);
        }
      })
      .on('broadcast', { event: 'activity' }, ({ payload }) => {
        setPartnerActivity(payload.activity ?? 'idle');
        if (payload.activity !== 'typing') setPartnerDraft('');
      })
      .subscribe();

    channelRef.current = channel;

    supabase.from('profiles').select('display_name').eq('id', partnerId).maybeSingle()
      .then(({ data }) => { if (data?.display_name) { setPartnerName(data.display_name); partnerNameRef.current = data.display_name; } });

    // Any new message from the partner clears the draft preview (it just
    // became a real message) and surfaces a brief "just sent" bubble.
    const msgChannel = supabase.channel(`activity-msgs-${pairKey}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${partnerId}` }, ({ new: row }: any) => {
        setPartnerDraft('');
        setPartnerActivity('idle');
        const preview = row.type === 'text' ? row.content : row.type === 'photo' ? '📷 Photo' : row.type === 'voice' ? '🎙️ Voice note' : '✍️ Drawing';
        setLastMessagePreview({ text: preview, senderIsMe: false, at: Date.now() });
        notifyIncomingMessage(partnerNameRef.current, preview, row.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(msgChannel);
      channelRef.current = null;
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [profile?.id, partnerId]);

  const sendDraft = (text: string) => {
    if (sendDebounceRef.current) clearTimeout(sendDebounceRef.current);
    sendDebounceRef.current = window.setTimeout(() => {
      channelRef.current?.send({ type: 'broadcast', event: 'draft', payload: { text } });
    }, DRAFT_DEBOUNCE_MS);
  };

  const sendActivity = (activity: Activity) => {
    channelRef.current?.send({ type: 'broadcast', event: 'activity', payload: { activity } });
  };

  const dismissBubble = () => setBubbleDismissedAt(Date.now());

  return (
    <Ctx.Provider value={{ partnerDraft, partnerActivity, partnerName, lastMessagePreview, sendDraft, sendActivity, dismissBubble, bubbleDismissedAt }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePartnerActivity() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePartnerActivity must be used within PartnerActivityProvider');
  return ctx;
}
