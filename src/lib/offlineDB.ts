// Vanilla IndexedDB layer — no external dependency, works fully offline.
// Two stores:
//   outbox   — messages/media waiting to be sent to Supabase
//   messages — a local mirror of everything the user has seen, so the
//              board renders instantly on launch with zero network calls.

const DB_NAME = 'bond-offline';
const DB_VERSION = 1;
const OUTBOX_STORE = 'outbox';
const MESSAGES_STORE = 'messages';

export type OutboxType = 'text' | 'photo' | 'voice' | 'drawing';

export type OutboxItem = {
  client_id: string;
  sender_id: string;
  recipient_id: string;
  type: OutboxType;
  content: string;
  media_blob?: Blob;
  media_mime?: string;
  duration_ms?: number;
  created_at: string;
  attempts: number;
  replyToPreview?: string;
  replyToSenderId?: string;
};

export type LocalMessage = {
  id: string; // real id once synced, otherwise client_id
  client_id: string;
  sender_id: string;
  recipient_id: string;
  type: OutboxType;
  content: string;
  media_url?: string; // object URL for locally-held blobs, or remote URL once synced
  media_blob?: Blob;
  duration_ms?: number;
  created_at: string;
  pending: boolean; // true until confirmed written to Supabase
  read_at?: string | null;
  reactions?: Record<string, string>;
  replyToPreview?: string;
  replyToSenderId?: string;
  pinned?: boolean;
  edited_at?: string | null;
  deleted_for_everyone?: boolean;
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        db.createObjectStore(OUTBOX_STORE, { keyPath: 'client_id' });
      }
      if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
        const store = db.createObjectStore(MESSAGES_STORE, { keyPath: 'client_id' });
        store.createIndex('created_at', 'created_at');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, mode);
    const req = fn(transaction.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function addToOutbox(item: OutboxItem): Promise<void> {
  await tx(OUTBOX_STORE, 'readwrite', (s) => s.put(item));
}

export async function getOutbox(): Promise<OutboxItem[]> {
  return tx(OUTBOX_STORE, 'readonly', (s) => s.getAll());
}

export async function removeFromOutbox(client_id: string): Promise<void> {
  await tx(OUTBOX_STORE, 'readwrite', (s) => s.delete(client_id));
}

export async function bumpAttempts(client_id: string): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction(OUTBOX_STORE, 'readwrite');
  const store = transaction.objectStore(OUTBOX_STORE);
  const item: OutboxItem | undefined = await new Promise((resolve) => {
    const r = store.get(client_id);
    r.onsuccess = () => resolve(r.result);
  });
  if (item) {
    item.attempts += 1;
    store.put(item);
  }
}

export async function cacheLocalMessage(msg: LocalMessage): Promise<void> {
  await tx(MESSAGES_STORE, 'readwrite', (s) => s.put(msg));
}

export async function getLocalMessages(): Promise<LocalMessage[]> {
  const all = await tx<LocalMessage[]>(MESSAGES_STORE, 'readonly', (s) => s.getAll());
  return all.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function markSynced(client_id: string, realId: string, mediaUrl?: string): Promise<void> {
  const db = await openDB();
  const transaction = db.transaction(MESSAGES_STORE, 'readwrite');
  const store = transaction.objectStore(MESSAGES_STORE);
  const existing: LocalMessage | undefined = await new Promise((resolve) => {
    const r = store.get(client_id);
    r.onsuccess = () => resolve(r.result);
  });
  if (existing) {
    existing.id = realId;
    existing.pending = false;
    if (mediaUrl) existing.media_url = mediaUrl;
    store.put(existing);
  }
}
