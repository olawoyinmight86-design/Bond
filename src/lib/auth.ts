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
    } catch (err) {
      console.error('Auth init error:', err);
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
    
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      
      if (error) {
        console.error('Profile fetch error:', error);
        const cached = cacheGet<Profile>('profile');
        if (cached) set({ profile: cached });
        return;
      }
      
      if (!data) {
        console.warn('Profile does not exist, attempting to create...');
        
        // Generate a random partner code
        const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        const { data: created, error: createErr } = await supabase
          .from('profiles')
          .insert({ 
            id: user.id, 
            email: user.email,
            partner_code: randomCode 
          })
          .select('*')
          .maybeSingle();
        
        if (createErr) {
          console.error('Profile creation error:', createErr);
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
    } catch (err) {
      console.error('Unexpected error in refreshProfile:', err);
      const cached = cacheGet<Profile>('profile');
      if (cached) set({ profile: cached });
    }
  },

  updateProfile: async (updates) => {
    const user = get().user;
    if (!user) return { error: 'Not authenticated' };
    
    try {
      const { data, error } = await supabase.from('profiles').update(updates).eq('id', user.id).select('*').maybeSingle();
      if (error) {
        console.error('Profile update error:', error);
        return { error: error.message };
      }
      if (data) {
        const profile = data as Profile;
        cacheSet('profile', profile);
        set({ profile });
      }
      return { error: null };
    } catch (err) {
      console.error('Unexpected error in updateProfile:', err);
      return { error: 'Unexpected error' };
    }
  },
}));
