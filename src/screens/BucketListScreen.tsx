import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Check, Trash2 } from 'lucide-react';

type Item = { id: string; title: string; category: string; completed: boolean; added_by: string };

const CATEGORIES = ['general', 'travel', 'food', 'movies', 'goals', 'home'];

export default function BucketListScreen() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('general');
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<'active' | 'completed'>('active');

  const load = useCallback(async () => {
    const { data } = await supabase.from('bucket_list_items').select('id, title, category, completed, added_by').order('created_at', { ascending: false });
    setItems(data ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase.channel('bucket-list').on('postgres_changes', { event: '*', schema: 'public', table: 'bucket_list_items' }, load).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, load]);

  const addItem = async () => {
    if (!title.trim()) return;
    setAdding(true);
    await supabase.rpc('add_bucket_item', { p_title: title.trim(), p_category: category });
    setTitle('');
    setAdding(false);
    load();
  };

  const toggleItem = async (item: Item) => {
    await supabase.from('bucket_list_items').update({ completed: !item.completed, completed_at: !item.completed ? new Date().toISOString() : null }).eq('id', item.id);
    load();
  };

  const deleteItem = async (id: string) => {
    await supabase.from('bucket_list_items').delete().eq('id', id);
    load();
  };

  const visible = items.filter((i) => (filter === 'active' ? !i.completed : i.completed));

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-center gap-3">
        <button onClick={() => navigate('/')} className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface shadow-soft active:scale-95 transition-transform"><ArrowLeft size={16} /></button>
        <h1 className="font-display text-display-sm text-ink-900">Bucket List</h1>
      </div>

      <div className="mb-4 rounded-2xl bg-surface p-4 shadow-soft">
        <div className="flex gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addItem()} placeholder="Watch the northern lights..." className="input flex-1 py-2.5 text-sm" />
          <button onClick={addItem} disabled={adding || !title.trim()} className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white disabled:opacity-40">
            <Plus size={18} />
          </button>
        </div>
        <div className="mt-2.5 flex gap-1.5 overflow-x-auto no-scrollbar">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategory(c)} className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-colors ${category === c ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-500'}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex gap-2 rounded-2xl bg-surface p-1.5 shadow-soft">
        <button onClick={() => setFilter('active')} className={`flex-1 rounded-xl py-2 text-sm font-medium ${filter === 'active' ? 'bg-brand-500 text-white' : 'text-ink-500'}`}>To do ({items.filter((i) => !i.completed).length})</button>
        <button onClick={() => setFilter('completed')} className={`flex-1 rounded-xl py-2 text-sm font-medium ${filter === 'completed' ? 'bg-brand-500 text-white' : 'text-ink-500'}`}>Done ({items.filter((i) => i.completed).length})</button>
      </div>

      <div className="space-y-2">
        {visible.length === 0 && (
          <p className="py-8 text-center text-sm text-ink-400">{filter === 'active' ? 'Nothing here yet — add your first dream together.' : 'Nothing checked off yet.'}</p>
        )}
        {visible.map((item) => (
          <div key={item.id} className={`flex items-center gap-3 rounded-2xl bg-surface p-3.5 shadow-soft transition-all ${item.completed ? 'opacity-60' : ''}`}>
            <button onClick={() => toggleItem(item)} className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${item.completed ? 'border-brand-500 bg-brand-500 text-white' : 'border-ink-200'}`}>
              {item.completed && <Check size={13} />}
            </button>
            <div className="min-w-0 flex-1">
              <p className={`text-sm text-ink-800 ${item.completed ? 'line-through' : ''}`}>{item.title}</p>
              <p className="text-[11px] capitalize text-ink-400">{item.category}</p>
            </div>
            <button onClick={() => deleteItem(item.id)} className="flex-shrink-0 text-ink-300"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
