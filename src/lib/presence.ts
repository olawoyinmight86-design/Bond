import { useEffect, useRef } from 'react';
import { supabase } from './supabase';

export function usePresenceHeartbeat(userId: string | undefined) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!userId) return;

    const setOnline = async () => {
      await supabase
        .from('presence')
        .upsert({ user_id: userId, online: true, last_seen: new Date().toISOString() });
    };

    const setOffline = async () => {
      await supabase
        .from('presence')
        .upsert({ user_id: userId, online: false, last_seen: new Date().toISOString() });
    };

    setOnline();
    intervalRef.current = setInterval(setOnline, 20000);

    const handleVisibility = () => {
      if (document.hidden) setOffline();
      else setOnline();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', setOffline);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', setOffline);
      setOffline();
    };
  }, [userId]);
}
