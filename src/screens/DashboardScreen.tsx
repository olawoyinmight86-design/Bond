import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../lib/auth';
import { supabase, cacheGet, cacheSet, type Profile } from '../lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { avatarEmoji, moodEmoji } from '../lib/emoji';
import { useOnlineStatus } from '../lib/useOnlineStatus';
import { Sparkles, ArrowUpRight } from 'lucide-react';

type PartnerData = { profile: Profile | null; online: boolean; lastSeen: string | null };

export default function DashboardScreen() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const [partner, setPartner] = useState<PartnerData>(() => {
    const cached = cacheGet<PartnerData>('partner_data');
    return cached ?? { profile: null, online: false, lastSeen: null };
  });
  const [momentCount, setMomentCount] = useState(() => cacheGet<number>('moment_count') ?? 0);
  const [recentMood, setRecentMood] = useState<string | null>(() => cacheGet<string>('recent_mood') ?? null);
  const [streak, setStreak] = useState(() => cacheGet<number>('streak') ?? 0);
  const [aiTip, setAiTip] = useState<string | null>(() => cacheGet<string>('ai_tip'));
  const [loadingTip, setLoadingTip] = useState(false);

  const loadPartner = useCallback(async () => {
    if (!profile?.paired_with) return;
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', profile.paired_with).maybeSingle();
      const { data: pres } = await supabase.from('presence').select('online, last_seen').eq('user_id', profile.paired_with).maybeSingle();
      const pd: PartnerData = { profile: data as Profile | null, online: pres?.online ?? false, lastSeen: pres?.last_seen ?? null };
      setPartner(pd);
      cacheSet('partner_data', pd);
    } catch {
      // offline — keep cached data
    }
  }, [profile?.paired_with]);

  const loadStats = useCallback(async () => {
    if (!profile?.paired_with) return;
    try {
      const { count } = await supabase.from('timeline').select('*', { count: 'exact', head: true }).or(`user_id.eq.${profile.id},pair_id.eq.${profile.id}`);
      setMomentCount(count ?? 0);
      cacheSet('moment_count', count ?? 0);
      const { data: moodData } = await supabase.from('timeline').select('mood, type').eq('type', 'mood').or(`user_id.eq.${profile.id},pair_id.eq.${profile.id}`).order('created_at', { ascending: false }).limit(1).maybeSingle();
      const mood = moodData?.mood ?? null;
      setRecentMood(mood);
      cacheSet('recent_mood', mood);

      const { data: streakData } = await supabase.rpc('get_streak');
      if (typeof streakData === 'number') {
        setStreak(streakData);
        cacheSet('streak', streakData);
      }
    } catch {
      // offline — keep cached data
    }
  }, [profile?.id, profile?.paired_with]);

  const fetchAiTip = useCallback(async () => {
    setLoadingTip(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bond-ai`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ action: 'tip' }),
      });
      if (res.ok) {
        const data = await res.json();
        const tip = data.tip ?? data.message ?? null;
        setAiTip(tip);
        if (tip) cacheSet('ai_tip', tip);
      }
    } catch {
      // offline — keep cached tip
    } finally { setLoadingTip(false); }
  }, []);

  useEffect(() => { loadPartner(); loadStats(); }, [loadPartner, loadStats]);

  useEffect(() => {
    if (!profile?.paired_with || !online) return;
    const channel = supabase.channel('partner-presence').on('postgres_changes', { event: '*', schema: 'public', table: 'presence', filter: `user_id=eq.${profile.paired_with}` }, () => loadPartner()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.paired_with, loadPartner, online]);

  if (!profile) return null;

  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="text-sm text-ink-400">{greeting}, {profile.display_name}</p>
        <h1 className="font-display text-display text-ink-900 mt-1">{avatarEmoji(profile.avatar_emoji)}</h1>
      </div>

      {partner.profile ? (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-50 via-white to-accent-50/40 p-6 shadow-soft animate-slide-up">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand-100/40 blur-3xl" />
          <div className="pointer-events-none absolute -left-4 -bottom-4 h-24 w-24 rounded-full bg-accent-100/30 blur-2xl" />
          <div className="relative flex items-center gap-4">
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/80 text-3xl shadow-soft">
                {avatarEmoji(partner.profile.avatar_emoji)}
              </div>
              <span className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white ${partner.online ? 'bg-success-500 shadow-sm shadow-success-500/50' : 'bg-ink-300'}`} />
            </div>
            <div className="flex-1">
              <p className="font-display text-lg text-ink-900">{partner.profile.display_name}</p>
              <p className="text-sm text-ink-500">
                {partner.online ? 'Online now' : partner.lastSeen ? `Last seen ${formatDistanceToNow(new Date(partner.lastSeen))} ago` : 'Offline'}
              </p>
            </div>
            {streak > 0 && (
              <div className="flex flex-col items-center rounded-2xl bg-white/70 px-3 py-2">
                <span className="text-lg leading-none">🔥</span>
                <span className="mt-1 text-xs font-bold text-ink-800">{streak}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-ink-100 p-6 text-center text-sm text-ink-400 animate-fade-in">
          {online ? 'Loading partner info...' : 'Partner info will appear when you reconnect.'}
        </div>
      )}

      <div className="flex items-center gap-3 animate-slide-up stagger-1">
        <div className="flex-1">
          <p className="font-display text-3xl text-ink-900">{momentCount}</p>
          <p className="text-xs text-ink-400">moments together</p>
        </div>
        <div className="h-10 w-px bg-ink-200" />
        <div className="flex-1">
          <p className="text-3xl">{moodEmoji(recentMood)}</p>
          <p className="text-xs text-ink-400">latest mood</p>
        </div>
      </div>

      <div
        onClick={() => !aiTip && !loadingTip && fetchAiTip()}
        className="group relative cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-br from-accent-50/60 to-white p-5 shadow-soft transition-all duration-300 hover:shadow-lift animate-slide-up stagger-2"
      >
        <div className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full bg-accent-100/20 blur-2xl" />
        <div className="relative">
          <div className="mb-2 flex items-center gap-2 text-accent-600">
            <Sparkles size={16} />
            <span className="text-[13px] font-medium">Daily bond tip</span>
          </div>
          {aiTip ? (
            <p className="text-[15px] leading-relaxed text-ink-700 text-balance">{aiTip}</p>
          ) : loadingTip ? (
            <div className="space-y-2"><div className="h-3 w-3/4 rounded-full shimmer" /><div className="h-3 w-1/2 rounded-full shimmer" /></div>
          ) : (
            <p className="text-[15px] text-ink-500 group-hover:text-ink-700 transition-colors">
              {online ? 'Tap for a tip to strengthen your bond' : 'Tips available when online'}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 animate-slide-up stagger-3">
        <button onClick={() => navigate('/timeline')} className="group flex items-center justify-between rounded-2xl bg-white p-4 shadow-soft transition-all duration-300 hover:shadow-lift hover:-translate-y-0.5">
          <span className="text-sm font-medium text-ink-700">Timeline</span>
          <ArrowUpRight size={18} className="text-ink-300 transition-all group-hover:text-brand-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </button>
        <button onClick={() => navigate('/chat')} className="group flex items-center justify-between rounded-2xl bg-white p-4 shadow-soft transition-all duration-300 hover:shadow-lift hover:-translate-y-0.5">
          <span className="text-sm font-medium text-ink-700">Chat</span>
          <ArrowUpRight size={18} className="text-ink-300 transition-all group-hover:text-accent-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </button>
      </div>
    </div>
  );
}
