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

const pageTitles: Record<string, string> = {
  '/': 'Home',
  '/timeline': 'Timeline',
  '/photobooth': 'Photobooth',
  '/chat': 'Chat',
  '/settings': 'Settings',
  '/games': 'Games',
  '/bucket-list': 'Bucket List',
  '/love-letters': 'Love Letters',
};

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

  const pageTitle = pageTitles[location.pathname] ?? 'Bond';

  const navLinkClass = (isActive: boolean) =>
    `relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 ${
      isActive ? 'text-brand-500 bg-brand-50/80' : 'text-ink-400 hover:text-ink-700 hover:bg-ink-100/60'
    }`;

  return (
    <div className="min-h-dvh bg-ink-50 lg:flex">
      {/* Desktop sidebar — 1024px and up */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-shrink-0 lg:flex-col lg:border-r lg:border-ink-200/60 lg:bg-surface lg:px-4 lg:py-6">
        <button onClick={() => navigate('/')} className="mb-8 flex items-center gap-2.5 px-2">
          <BraceletLogo className="h-8 w-8" glow />
          <span className="font-display text-xl text-ink-900">Bond</span>
        </button>
        <nav className="flex flex-col gap-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => navLinkClass(isActive)}>
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
        </nav>
        <div className="mt-auto flex items-center gap-2.5 rounded-xl px-2 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-100 text-lg">{avatarEmoji(profile?.avatar_emoji)}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink-800">{profile?.display_name ?? 'You'}</p>
          </div>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 safe-top lg:relative">
          <div className="glass border-b border-ink-100/50" style={{ minHeight: '64px' }}>
            <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-10">
              <button onClick={() => navigate('/')} className="flex items-center gap-2.5 lg:hidden">
                <BraceletLogo className="h-7 w-7" glow />
                <span className="font-display text-lg text-ink-900">Bond</span>
              </button>
              <span className="hidden font-display text-xl text-ink-900 lg:block">{pageTitle}</span>
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

        <div className="mx-auto w-full max-w-[1280px] px-4 pt-4 sm:px-6 lg:px-10">
          <InstallPrompt />
        </div>

        <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 pb-40 safe-bottom sm:px-6 lg:px-10 lg:pb-10">
          {children}
        </main>

        {/* Mobile/tablet floating bottom nav — hidden at desktop width */}
        <nav className="fixed bottom-0 left-0 right-0 z-30 safe-bottom lg:hidden">
          <div className="mx-auto max-w-2xl px-5 pb-3">
            <div className="flex items-center justify-around rounded-[24px] bg-surface/80 backdrop-blur-xl px-2 py-2 shadow-float border border-ink-200/60">
              {navItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `relative flex flex-1 flex-col items-center gap-1 rounded-xl py-2.5 text-[11px] font-medium transition-all duration-200 active:scale-90 ${
                      isActive ? 'text-brand-500 bg-brand-50/80' : 'text-ink-400 hover:text-ink-600'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className={`relative transition-transform duration-300 ease-bounce ${isActive ? 'scale-110' : 'scale-100'}`}>
                        <Icon size={20} />
                        {to === '/chat' && unread > 0 && (
                          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error-500 px-1 text-[9px] font-bold text-white">
                            {unread > 9 ? '9+' : unread}
                          </span>
                        )}
                      </span>
                      {label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}
