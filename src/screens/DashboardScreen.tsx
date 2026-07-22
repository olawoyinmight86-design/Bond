import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../lib/auth';
import { supabase, cacheGet, cacheSet, type Profile } from '../lib/supabase';
import { formatDistanceToNow, differenceInCalendarDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { avatarEmoji, moodEmoji } from '../lib/emoji';
import { useOnlineStatus } from '../lib/useOnlineStatus';
import { Sparkles, ArrowUpRight, MessageCircleQuestion, Gamepad2, CalendarHeart, Music, X } from 'lucide-react';
import { musicSearchLinks } from '../lib/music';

type PartnerData = { profile: Profile | null; online: boolean; lastSeen: string | null };
type DailyAnswerRow = { question: string; user_a: string; user_a_answer: string | null; user_b_answer: string | null };
type UpcomingDate = { title: string; event_date: string; recurring_yearly: boolean };

export default function DashboardScreen() {
  const { profile, updateProfile } = useAuth();
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
  const [dailyRow, setDailyRow] = useState<DailyAnswerRow | null>(() => cacheGet<DailyAnswerRow>('daily_row'));
  const [myAnswer, setMyAnswer] = useState('');
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [upcoming, setUpcoming] = useState<UpcomingDate | null>(() => cacheGet<UpcomingDate>('upcoming_date'));
  const [nowPlayingInput, setNowPlayingInput] = useState('');
  const [savingNowPlaying, setSavingNowPlaying] = useState(false);

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

  const loadDaily = useCallback(async () => {
    if (!profile?.id || !profile?.paired_with) return;
    try {
      const sorted = [profile.id, profile.paired_with].sort();
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase.from('daily_answers').select('question, user_a, user_a_answer, user_b_answer')
        .eq('user_a', sorted[0]).eq('user_b', sorted[1]).eq('prompt_date', today).maybeSingle();

      if (data) {
        setDailyRow(data as DailyAnswerRow);
        cacheSet('daily_row', data);
      } else {
        const { data: promptData } = await supabase.rpc('get_todays_prompt');
        const fresh = { question: promptData?.question ?? '', user_a: sorted[0], user_a_answer: null, user_b_answer: null };
        setDailyRow(fresh);
        cacheSet('daily_row', fresh);
      }
    } catch {
      // offline — keep cached prompt
    }
  }, [profile?.id, profile?.paired_with]);

  const submitDailyAnswer = async () => {
    if (!myAnswer.trim()) return;
    setSubmittingAnswer(true);
    try {
      await supabase.rpc('submit_daily_answer', { answer_text: myAnswer.trim() });
      setMyAnswer('');
      await loadDaily();
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const loadUpcoming = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data } = await supabase.from('important_dates').select('title, event_date, recurring_yearly');
      if (!data || data.length === 0) { setUpcoming(null); return; }

      const today = new Date();
      const withNextOccurrence = data.map((d) => {
        let next = new Date(d.event_date);
        if (d.recurring_yearly) {
          next.setFullYear(today.getFullYear());
          if (differenceInCalendarDays(next, today) < 0) next.setFullYear(today.getFullYear() + 1);
        }
        return { ...d, next };
      }).sort((a, b) => a.next.getTime() - b.next.getTime());

      const soonest = withNextOccurrence[0];
      const result = { title: soonest.title, event_date: soonest.next.toISOString(), recurring_yearly: soonest.recurring_yearly };
      setUpcoming(result);
      cacheSet('upcoming_date', result);
    } catch {
      // offline — keep cached
    }
  }, [profile?.id]);

  const setNowPlaying = async () => {
    if (!nowPlayingInput.trim()) return;
    setSavingNowPlaying(true);
    const [titlePart, ...rest] = nowPlayingInput.split(' - ');
    await updateProfile({
      now_playing_title: rest.length ? rest.join(' - ').trim() : titlePart.trim(),
      now_playing_artist: rest.length ? titlePart.trim() : '',
      now_playing_at: new Date().toISOString(),
    });
    setNowPlayingInput('');
    setSavingNowPlaying(false);
  };

  const clearNowPlaying = async () => {
    await updateProfile({ now_playing_title: null, now_playing_artist: null, now_playing_at: null });
  };

  useEffect(() => { loadPartner(); loadStats(); loadDaily(); loadUpcoming(); }, [loadPartner, loadStats, loadDaily, loadUpcoming]);

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

      {upcoming && (() => {
        const days = differenceInCalendarDays(new Date(upcoming.event_date), new Date());
        return (
          <div className="flex items-center gap-2.5 rounded-2xl bg-accent-50 px-4 py-3 animate-slide-up">
            <CalendarHeart size={16} className="flex-shrink-0 text-accent-600" />
            <p className="text-sm text-accent-700">
              {days === 0 ? `${upcoming.title} is today! 🎉` : days === 1 ? `${upcoming.title} is tomorrow!` : `${upcoming.title} in ${days} days`}
            </p>
          </div>
        );
      })()}

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

      {partner.profile?.now_playing_title && (() => {
        const links = musicSearchLinks(partner.profile.now_playing_title!, partner.profile.now_playing_artist ?? '');
        return (
          <div className="flex items-center gap-3 rounded-2xl bg-ink-900 p-4 text-white shadow-soft animate-slide-up">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white/10">
              <Music size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{partner.profile.now_playing_title}</p>
              <p className="truncate text-xs text-white/50">{partner.profile.display_name} is playing{partner.profile.now_playing_artist ? ` · ${partner.profile.now_playing_artist}` : ''}</p>
            </div>
            <a href={links.spotify} target="_blank" rel="noreferrer" className="flex-shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium">Listen</a>
          </div>
        );
      })()}

      <div className="rounded-2xl bg-white p-4 shadow-soft animate-slide-up">
        {profile.now_playing_title ? (
          <div className="flex items-center gap-3">
            <Music size={15} className="flex-shrink-0 text-brand-400" />
            <p className="min-w-0 flex-1 truncate text-sm text-ink-700">Sharing: <b>{profile.now_playing_title}</b>{profile.now_playing_artist ? ` · ${profile.now_playing_artist}` : ''}</p>
            <button onClick={clearNowPlaying} className="flex-shrink-0 text-ink-300"><X size={15} /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Music size={15} className="flex-shrink-0 text-ink-300" />
            <input
              value={nowPlayingInput} onChange={(e) => setNowPlayingInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setNowPlaying()}
              placeholder="Share what you're playing (Song - Artist)"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink-700 placeholder-ink-400 outline-none"
            />
            <button onClick={setNowPlaying} disabled={savingNowPlaying || !nowPlayingInput.trim()} className="flex-shrink-0 text-xs font-medium text-brand-500 disabled:opacity-40">Share</button>
          </div>
        )}
      </div>

      {dailyRow && (
        <div className="rounded-2xl bg-white p-5 shadow-soft animate-slide-up">
          <div className="mb-2 flex items-center gap-2 text-brand-500">
            <MessageCircleQuestion size={16} />
            <span className="text-[13px] font-medium">Question of the day</span>
          </div>
          <p className="mb-3 text-[15px] leading-relaxed text-ink-800 text-balance">{dailyRow.question}</p>

          {(dailyRow.user_a === profile.id ? dailyRow.user_a_answer : dailyRow.user_b_answer) ? (
            <div className="space-y-2">
              <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-ink-700">
                <span className="font-medium text-brand-600">You: </span>
                {dailyRow.user_a === profile.id ? dailyRow.user_a_answer : dailyRow.user_b_answer}
              </p>
              {(dailyRow.user_a === profile.id ? dailyRow.user_b_answer : dailyRow.user_a_answer) ? (
                <p className="rounded-xl bg-ink-50 px-3 py-2 text-sm text-ink-700">
                  <span className="font-medium text-ink-500">{partner.profile?.display_name ?? 'Partner'}: </span>
                  {dailyRow.user_a === profile.id ? dailyRow.user_b_answer : dailyRow.user_a_answer}
                </p>
              ) : (
                <p className="text-xs text-ink-400">Waiting for {partner.profile?.display_name ?? 'your partner'} to answer...</p>
              )}
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                value={myAnswer} onChange={(e) => setMyAnswer(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitDailyAnswer()}
                placeholder="Your answer..."
                className="input flex-1 py-2.5 text-sm"
              />
              <button onClick={submitDailyAnswer} disabled={submittingAnswer || !myAnswer.trim()} className="btn-primary px-4 disabled:opacity-40">
                {submittingAnswer ? '...' : 'Send'}
              </button>
            </div>
          )}
        </div>
      )}

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

      <div className="grid grid-cols-3 gap-2.5 animate-slide-up stagger-3">
        <button onClick={() => navigate('/timeline')} className="group flex flex-col items-center gap-1.5 rounded-2xl bg-white p-4 shadow-soft transition-all duration-300 hover:shadow-lift hover:-translate-y-0.5">
          <span className="text-sm font-medium text-ink-700">Timeline</span>
          <ArrowUpRight size={16} className="text-ink-300 transition-all group-hover:text-brand-400" />
        </button>
        <button onClick={() => navigate('/chat')} className="group flex flex-col items-center gap-1.5 rounded-2xl bg-white p-4 shadow-soft transition-all duration-300 hover:shadow-lift hover:-translate-y-0.5">
          <span className="text-sm font-medium text-ink-700">Chat</span>
          <ArrowUpRight size={16} className="text-ink-300 transition-all group-hover:text-accent-400" />
        </button>
        <button onClick={() => navigate('/games')} className="group flex flex-col items-center gap-1.5 rounded-2xl bg-white p-4 shadow-soft transition-all duration-300 hover:shadow-lift hover:-translate-y-0.5">
          <span className="flex items-center gap-1 text-sm font-medium text-ink-700"><Gamepad2 size={14} /> Games</span>
        </button>
        <button onClick={() => navigate('/bucket-list')} className="group flex flex-col items-center gap-1.5 rounded-2xl bg-white p-4 shadow-soft transition-all duration-300 hover:shadow-lift hover:-translate-y-0.5">
          <span className="text-sm font-medium text-ink-700">Bucket List</span>
        </button>
        <button onClick={() => navigate('/love-letters')} className="group flex flex-col items-center gap-1.5 rounded-2xl bg-white p-4 shadow-soft transition-all duration-300 hover:shadow-lift hover:-translate-y-0.5">
          <span className="text-sm font-medium text-ink-700">Letters</span>
        </button>
        <button onClick={() => navigate('/photobooth')} className="group flex flex-col items-center gap-1.5 rounded-2xl bg-white p-4 shadow-soft transition-all duration-300 hover:shadow-lift hover:-translate-y-0.5">
          <span className="text-sm font-medium text-ink-700">Booth</span>
        </button>
      </div>
    </div>
  );
}
