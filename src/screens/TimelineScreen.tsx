import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../lib/auth';
import { supabase, cacheGet, cacheSet, type TimelineEntry } from '../lib/supabase';
import { format } from 'date-fns';
import { Plus, Smile, FileText, Star, Trash2, X } from 'lucide-react';
import { avatarEmoji, moodEmoji, MOOD_EMOJIS, MOOD_LABELS } from '../lib/emoji';
import { useOnlineStatus } from '../lib/useOnlineStatus';

type AddType = 'note' | 'mood' | 'milestone';

export default function TimelineScreen() {
  const { profile } = useAuth();
  const online = useOnlineStatus();
  const [entries, setEntries] = useState<TimelineEntry[]>(() => cacheGet<TimelineEntry[]>('timeline_entries') ?? []);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState<AddType>('note');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.paired_with) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('timeline').select('*').or(`user_id.eq.${profile.id},pair_id.eq.${profile.id}`).order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      const list = (data as TimelineEntry[]) ?? [];
      setEntries(list);
      cacheSet('timeline_entries', list);
    } catch {
      // offline — keep cached entries
    } finally {
      setLoading(false);
    }
  }, [profile?.id, profile?.paired_with]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!profile?.paired_with || !online) return;
    const channel = supabase.channel('timeline-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'timeline' }, () => load()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.paired_with, load, online]);

  const handleAdd = async () => {
    if (!content.trim() && addType !== 'mood') return;
    if (addType === 'mood' && !mood) return;
    setBusy(true);
    const entry: Record<string, unknown> = {
      user_id: profile!.id, pair_id: profile!.paired_with, type: addType,
      content: content.trim() || (addType === 'mood' ? `Feeling ${MOOD_LABELS[mood] ?? mood}` : ''),
      mood: addType === 'mood' ? mood : null,
    };
    try {
      const { data, error } = await supabase.from('timeline').insert(entry).select('*').maybeSingle();
      if (error) throw error;
      if (data) {
        const newEntry = data as TimelineEntry;
        const updated = [newEntry, ...entries];
        setEntries(updated);
        cacheSet('timeline_entries', updated);
      }
    } catch {
      // offline — save locally and show as pending
      const tempEntry: TimelineEntry = {
        id: crypto.randomUUID(),
        user_id: profile!.id,
        type: addType as TimelineEntry['type'],
        content: (entry.content as string) || '',
        mood: (entry.mood as string) || null,
        created_at: new Date().toISOString(),
      };
      const updated = [tempEntry, ...entries];
      setEntries(updated);
      cacheSet('timeline_entries', updated);
    } finally {
      setBusy(false);
      setContent(''); setMood(''); setShowAdd(false);
    }
  };

  const handleDelete = async (id: string) => {
    const prev = entries;
    const updated = entries.filter(e => e.id !== id);
    setEntries(updated);
    cacheSet('timeline_entries', updated);
    try {
      await supabase.from('timeline').delete().eq('id', id);
    } catch {
      // offline — restore if delete fails
      setEntries(prev);
      cacheSet('timeline_entries', prev);
    }
  };

  const isOwn = (e: TimelineEntry) => e.user_id === profile?.id;

  const grouped: { date: string; items: TimelineEntry[] }[] = [];
  for (const entry of entries) {
    const dateKey = format(new Date(entry.created_at), 'yyyy-MM-dd');
    const group = grouped.find(g => g.date === dateKey);
    if (group) group.items.push(entry); else grouped.push({ date: dateKey, items: [entry] });
  }

  const formatDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) return 'Today';
    if (format(date, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd')) return 'Yesterday';
    return format(date, 'EEEE, MMM d');
  };

  if (loading && entries.length === 0) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="h-8 w-32 rounded-lg shimmer" />
        <div className="h-24 rounded-2xl shimmer" />
        <div className="h-24 rounded-2xl shimmer" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-display-sm text-ink-900">Timeline</h1>
        <button onClick={() => setShowAdd(true)} className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-white shadow-glow-brand transition-all duration-200 hover:scale-105 active:scale-95">
          <Plus size={20} />
        </button>
      </div>

      {showAdd && (
        <>
          <div className="fixed inset-0 z-40 bg-ink-950/20 backdrop-blur-sm animate-fade-in" onClick={() => setShowAdd(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 safe-bottom animate-slide-up">
            <div className="mx-auto max-w-2xl rounded-t-3xl bg-surface p-6 shadow-float">
              <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-ink-200" />
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-display text-lg text-ink-900">New moment</h2>
                <button onClick={() => setShowAdd(false)} className="text-ink-400 hover:text-ink-600"><X size={20} /></button>
              </div>
              <div className="mb-5 flex gap-2">
                {([{ key: 'note', label: 'Note', icon: FileText }, { key: 'mood', label: 'Mood', icon: Smile }, { key: 'milestone', label: 'Milestone', icon: Star }] as const).map(({ key, label, icon: Icon }) => (
                  <button key={key} onClick={() => setAddType(key)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium transition-all duration-200 ${addType === key ? 'bg-brand-50 text-brand-600 ring-1 ring-brand-200' : 'bg-ink-50 text-ink-500 hover:bg-ink-100'}`}>
                    <Icon size={16} />{label}
                  </button>
                ))}
              </div>
              {addType === 'mood' && (
                <div className="mb-5 grid grid-cols-4 gap-3">
                  {MOOD_EMOJIS.map((m) => (
                    <button key={m} onClick={() => setMood(m)} className={`flex flex-col items-center gap-1 rounded-2xl py-3 transition-all duration-200 ${mood === m ? 'bg-brand-50 ring-2 ring-brand-300 scale-105' : 'bg-ink-50 hover:bg-ink-100'}`}>
                      <span className="text-3xl">{m}</span>
                      <span className="text-[10px] text-ink-400">{MOOD_LABELS[m]}</span>
                    </button>
                  ))}
                </div>
              )}
              {addType !== 'mood' && (
                <textarea value={content} onChange={(e) => setContent(e.target.value)} className="input mb-5 min-h-[100px] resize-none" placeholder={addType === 'milestone' ? 'What milestone did you reach?' : 'Write a sweet note...'} autoFocus />
              )}
              <button onClick={handleAdd} disabled={busy} className="btn-primary w-full py-3.5">{busy ? 'Adding...' : 'Add to timeline'}</button>
            </div>
          </div>
        </>
      )}

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-3xl">✨</div>
          <p className="text-sm text-ink-500 text-center text-balance">Your timeline is empty.<br />Share your first moment together.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <div key={group.date}>
              <p className="mb-3 text-[13px] font-medium text-ink-400 uppercase tracking-wider">{formatDateLabel(group.date)}</p>
              <div className="space-y-3">
                {group.items.map((entry) => (
                  <div key={entry.id} className="group relative rounded-2xl bg-surface p-4 shadow-soft transition-all duration-300 hover:shadow-lift animate-slide-up">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-base">{isOwn(entry) ? avatarEmoji(profile?.avatar_emoji) : '💕'}</span>
                      <span className="text-xs text-ink-400">{isOwn(entry) ? 'You' : 'Partner'}</span>
                      {entry.type === 'milestone' && (
                        <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-600"><Star size={10} /> Milestone</span>
                      )}
                    </div>
                    {entry.type === 'mood' ? (
                      <div className="flex items-center gap-3">
                        <span className="text-4xl">{moodEmoji(entry.mood)}</span>
                        <span className="text-sm text-ink-500">{entry.content}</span>
                      </div>
                    ) : (
                      <p className="text-[15px] leading-relaxed text-ink-700">{entry.content}</p>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11px] text-ink-300">{format(new Date(entry.created_at), 'h:mm a')}</span>
                      {isOwn(entry) && (
                        <button onClick={() => handleDelete(entry.id)} className="text-ink-300 opacity-0 transition-all hover:text-error-500 group-hover:opacity-100"><Trash2 size={14} /></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
