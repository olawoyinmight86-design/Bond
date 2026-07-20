import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Home, Clock, MessageCircle, Camera, Settings, WifiOff } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { usePresenceHeartbeat } from '../lib/presence';
import { useOnlineStatus } from '../lib/useOnlineStatus';
import { avatarEmoji } from '../lib/emoji';
import { BraceletLogo } from './BraceletLogo';
import InstallPrompt from './InstallPrompt';
import { setBadgeCount } from '../lib/badge';
import { supabase } from '../lib/supabase';

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/timeline', label: 'Timeline', icon: Clock },
  { to: '/photobooth', label: 'Booth', icon: Camera },
  { to: '/chat', label: 'Chat', icon: MessageCircle },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const online = useOnlineStatus();
  const [unread, setUnread] = useState(0);
  usePresenceHeartbeat(profile?.id);

  useEffect(() => {
    if (!profile?.id) return;

    const refreshUnread = async () => {
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', profile.id)
        .is('read_at', null);
      const n = count ?? 0;
      setUnread(n);
      setBadgeCount(n);
    };

    refreshUnread();

    const channel = supabase
      .channel('appshell-unread')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `recipient_id=eq.${profile.id}` }, refreshUnread)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.id]);

  // Clear as soon as the user opens Chat, so the badge doesn't linger.
  useEffect(() => {
    if (location.pathname === '/chat') { setUnread(0); setBadgeCount(0); }
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-ink-50">
      <header className="sticky top-0 z-30 safe-top">
        <div className="glass border-b border-ink-100/50">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3">
            <button onClick={() => navigate('/')} className="flex items-center gap-2.5">
              <BraceletLogo className="h-7 w-7" glow />
              <span className="font-display text-lg text-ink-900">Bond</span>
            </button>
            <span className="text-xl">{avatarEmoji(profile?.avatar_emoji)}</span>
          </div>
        </div>
      </header>

      {!online && (
        <div className="flex items-center justify-center gap-2 bg-ink-800 px-4 py-2 text-center text-xs text-ink-100 animate-slide-up">
          <WifiOff size={14} />
          You're offline — showing cached data. Changes will sync when you reconnect.
        </div>
      )}

      <div className="mx-auto max-w-2xl pt-4">
        <InstallPrompt />
      </div>

      <main className="mx-auto max-w-2xl px-5 py-6 pb-28 safe-bottom">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 safe-bottom">
        <div className="mx-auto max-w-2xl px-5 pb-3">
          <div className="glass flex items-center justify-around rounded-2xl px-2 py-2 shadow-float">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `relative flex flex-1 flex-col items-center gap-1 rounded-xl py-2.5 text-[11px] font-medium transition-all duration-200 ${
                    isActive ? 'text-brand-500 bg-brand-50/80' : 'text-ink-400 hover:text-ink-600'
                  }`
                }
              >
                <span className="relative">
                  <Icon size={20} />
                  {to === '/chat' && unread > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error-500 px-1 text-[9px] font-bold text-white">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </span>
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
}
