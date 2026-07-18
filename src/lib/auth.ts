import { create } from 'zustand';
import { supabase, cacheGet, cacheSet, cacheRemove, type Profile } from './supabase';
import type { Session, User } from '@supabase/supabase-js';

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: string | null }>;
};

export const useAuth = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  loading: true,
  initialized: false,

  init: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      set({ session, user: session?.user ?? null, loading: false, initialized: true });

      supabase.auth.onAuthStateChange((_event, session) => {
        set({ session, user: session?.user ?? null });
        if (session?.user) {
          get().refreshProfile();
        } else {
          set({ profile: null });
          cacheRemove('profile');
        }
      });

      if (session?.user) {
        await get().refreshProfile();
      }
    } catch {
      // Network failure — try cached profile
      const cached = cacheGet<Profile>('profile');
      set({ loading: false, initialized: true, profile: cached });
    }
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  },

  signUp: async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message, needsConfirmation: false };
    // If no session returned, email confirmation is required
    if (!data.session) {
      return { error: null, needsConfirmation: true };
    }
    return { error: null, needsConfirmation: false };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    cacheRemove('profile');
    set({ profile: null, session: null, user: null });
  },

  refreshProfile: async () => {
    const user = get().user;
    if (!user) return;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (error) {
      // Fall back to cached profile if network fails
      const cached = cacheGet<Profile>('profile');
      if (cached) set({ profile: cached });
      return;
    }
    if (!data) {
      // Trigger should have created it, but fallback to client-side upsert
      const { data: created, error: createErr } = await supabase
        .from('profiles')
        .upsert({ id: user.id, email: user.email })
        .select('*')
        .maybeSingle();
      if (createErr) {
        const cached = cacheGet<Profile>('profile');
        if (cached) set({ profile: cached });
        return;
      }
      if (created) {
        const profile = created as Profile;
        cacheSet('profile', profile);
        set({ profile });
      }
      return;
    }
    const profile = data as Profile;
    cacheSet('profile', profile);
    set({ profile });
  },

  updateProfile: async (updates) => {
    const user = get().user;
    if (!user) return { error: 'Not authenticated' };
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', user.id).select('*').maybeSingle();
    if (error) return { error: error.message };
    if (data) {
      const profile = data as Profile;
      cacheSet('profile', profile);
      set({ profile });
    }
    return { error: null };
  },
}));
