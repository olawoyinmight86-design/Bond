import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing required Supabase environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Check your .env file and Vercel environment settings.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: { eventsPerSecond: 2 },
  },
  global: {
    headers: { 'X-Client-Info': 'bond-app' },
  },
});

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_emoji: string | null;
  partner_code: string | null;
  paired_with: string | null;
  onboarding_complete: boolean;
  created_at: string;
  phone_number?: string | null;
  now_playing_title?: string | null;
  now_playing_artist?: string | null;
  now_playing_at?: string | null;
};

export type TimelineEntry = {
  id: string;
  user_id: string;
  type: 'note' | 'mood' | 'photo' | 'milestone';
  content: string;
  mood: string | null;
  created_at: string;
};

export type PresenceState = {
  user_id: string;
  online: boolean;
  last_seen: string;
};

// Simple localStorage cache for offline support
const CACHE_PREFIX = 'bond_cache_';

export function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    return raw ? JSON.parse(raw) as T : null;
  } catch { return null; }
}

export function cacheSet<T>(key: string, data: T): void {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
  } catch { /* storage full or unavailable */ }
}

export function cacheRemove(key: string): void {
  try { localStorage.removeItem(CACHE_PREFIX + key); } catch { /* noop */ }
}
