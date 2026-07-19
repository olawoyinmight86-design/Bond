import { supabase } from './supabase';
import {
  addToOutbox, getOutbox, removeFromOutbox, bumpAttempts,
  cacheLocalMessage, markSynced,
  type OutboxItem, type OutboxType, type LocalMessage,
} from './offlineDB';

const EXT: Record<OutboxType, string> = { text: '', photo: 'jpg', voice: 'webm', drawing: 'png' };

type Listener = () => void;
const listeners = new Set<Listener>();
export function onQueueChange(fn: Listener) { listeners.add(fn); return () => listeners.delete(fn); }
function notify() { listeners.forEach((fn) => fn()); }

let flushing = false;

/**
 * Compose a message of any type. Writes to the local device instantly —
 * works with zero connectivity — and queues it for delivery. Delivery
 * happens automatically the moment a connection exists; there is no send
 * button and nothing for the user to retry manually.
 */
export async function composeMessage(params: {
  senderId: string;
  recipientId: string;
  type: OutboxType;
  content?: string;
  mediaBlob?: Blob;
  mediaMime?: string;
  durationMs?: number;
}): Promise<LocalMessage> {
  const client_id = crypto.randomUUID();
  const created_at = new Date().toISOString();

  const local: LocalMessage = {
    id: client_id,
    client_id,
    sender_id: params.senderId,
    recipient_id: params.recipientId,
    type: params.type,
    content: params.content ?? '',
    media_blob: params.mediaBlob,
    media_url: params.mediaBlob ? URL.createObjectURL(params.mediaBlob) : undefined,
    duration_ms: params.durationMs,
    created_at,
    pending: true,
  };

  await cacheLocalMessage(local);

  const outboxItem: OutboxItem = {
    client_id,
    sender_id: params.senderId,
    recipient_id: params.recipientId,
    type: params.type,
    content: params.content ?? '',
    media_blob: params.mediaBlob,
    media_mime: params.mediaMime,
    duration_ms: params.durationMs,
    created_at,
    attempts: 0,
  };
  await addToOutbox(outboxItem);
  notify();

  // Try immediately in case we're actually online — no artificial delay.
  void flushOutbox();

  return local;
}

/** Attempts to deliver everything sitting in the outbox. Safe to call as
 * often as you like — it no-ops if already running or if there's nothing
 * to send, and silently gives up (leaving items queued) if offline. */
export async function flushOutbox(): Promise<void> {
  if (flushing) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  flushing = true;
  try {
    const items = await getOutbox();
    for (const item of items) {
      try {
        let media_path: string | undefined;
        if (item.media_blob) {
          const ext = EXT[item.type] || 'bin';
          media_path = `${item.sender_id}/${item.client_id}.${ext}`;
          const { error: uploadErr } = await supabase.storage
            .from('chat-media')
            .upload(media_path, item.media_blob, {
              contentType: item.media_mime,
              upsert: true,
            });
          if (uploadErr) throw uploadErr;
        }

        const { data, error } = await supabase
          .from('messages')
          .insert({
            sender_id: item.sender_id,
            recipient_id: item.recipient_id,
            type: item.type,
            content: item.content,
            media_path,
            duration_ms: item.duration_ms,
            client_id: item.client_id,
          })
          .select('id, media_path')
          .maybeSingle();

        // Unique(sender_id, client_id) means a duplicate retry after a
        // dropped response is a no-op success, not an error.
        if (error && !error.message.includes('duplicate key')) throw error;

        let mediaUrl: string | undefined;
        if (media_path) {
          const { data: signed } = await supabase.storage
            .from('chat-media')
            .createSignedUrl(media_path, 60 * 60 * 24 * 7);
          mediaUrl = signed?.signedUrl;
        }

        await markSynced(item.client_id, data?.id ?? item.client_id, mediaUrl);
        await removeFromOutbox(item.client_id);
        notify();
      } catch {
        // Still offline, or a transient failure — leave it queued.
        // It will be retried automatically next time flushOutbox runs.
        await bumpAttempts(item.client_id);
      }
    }
  } finally {
    flushing = false;
  }
}

let started = false;

/** Call once, near app startup. Makes delivery fully automatic: retries
 * on reconnect, on app foreground, and on a periodic timer as a safety net. */
export function startAutoSync(): () => void {
  if (started) return () => {};
  started = true;

  const onOnline = () => void flushOutbox();
  const onVisible = () => { if (document.visibilityState === 'visible') void flushOutbox(); };

  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  const interval = setInterval(() => void flushOutbox(), 15_000);

  void flushOutbox();

  return () => {
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
    clearInterval(interval);
    started = false;
  };
}
