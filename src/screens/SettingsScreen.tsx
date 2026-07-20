import { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { useNavigate } from 'react-router-dom';
import { AVATAR_EMOJIS, avatarEmoji } from '../lib/emoji';
import { Check, LogOut, Bell, BellOff, UserX } from 'lucide-react';
import { enablePushNotifications } from '../lib/push';
import { supabase } from '../lib/supabase';

export default function SettingsScreen() {
  const { profile, updateProfile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [emoji, setEmoji] = useState(profile?.avatar_emoji ?? AVATAR_EMOJIS[0]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pushStatus, setPushStatus] = useState<'idle' | 'checking' | 'on' | 'off' | 'unsupported'>('idle');
  const [pushError, setPushError] = useState<string | null>(null);
  const [confirmUnpair, setConfirmUnpair] = useState(false);
  const [unpairing, setUnpairing] = useState(false);

  const handleUnpair = async () => {
    setUnpairing(true);
    try {
      const { data, error } = await supabase.rpc('unpair_me');
      if (error || !data?.success) throw new Error(error?.message ?? 'Could not unpair');
      await refreshProfile();
    } catch {
      setUnpairing(false);
      setConfirmUnpair(false);
    }
  };

  useEffect(() => {
    if (!('Notification' in window)) { setPushStatus('unsupported'); return; }
    setPushStatus(Notification.permission === 'granted' ? 'on' : 'off');
  }, []);

  const handleEnablePush = async () => {
    if (!profile?.id) return;
    setPushStatus('checking');
    setPushError(null);
    const result = await enablePushNotifications(profile.id);
    if (result.ok) {
      setPushStatus('on');
    } else {
      setPushStatus('off');
      setPushError(result.reason ?? 'Could not enable notifications');
    }
  };

  const handleSave = async () => {
    setBusy(true);
    await updateProfile({ display_name: name.trim(), avatar_emoji: emoji });
    setBusy(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSignOut = async () => { await signOut(); navigate('/'); };

  if (!profile) return null;

  return (
    <div className="space-y-8 animate-fade-in">
      <h1 className="font-display text-display-sm text-ink-900">Settings</h1>

      <section>
        <p className="mb-3 text-[13px] font-medium text-ink-400 uppercase tracking-wider">Profile</p>
        <div className="space-y-4 rounded-2xl bg-white p-5 shadow-soft">
          <div>
            <label className="label" htmlFor="name">Display name</label>
            <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </div>
          <div>
            <span className="label">Avatar</span>
            <div className="grid grid-cols-8 gap-2">
              {AVATAR_EMOJIS.map((e) => (
                <button key={e} onClick={() => setEmoji(e)} className={`flex aspect-square items-center justify-center rounded-xl text-2xl transition-all duration-200 ${emoji === e ? 'bg-brand-100 ring-2 ring-brand-400 scale-110' : 'bg-ink-50 hover:bg-ink-100 hover:scale-105'}`}>{e}</button>
              ))}
            </div>
          </div>
          <button onClick={handleSave} disabled={busy} className="btn-primary w-full py-3">
            {busy ? 'Saving...' : saved ? <span className="flex items-center gap-1.5"><Check size={16} /> Saved</span> : 'Save changes'}
          </button>
        </div>
      </section>

      <section>
        <p className="mb-3 text-[13px] font-medium text-ink-400 uppercase tracking-wider">Pairing</p>
        <div className="rounded-2xl bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-ink-500">Your partner code</p>
              <p className="mt-1 font-mono text-lg tracking-[0.2em] font-semibold text-ink-900">{profile.partner_code ?? '------'}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-2xl">{avatarEmoji(profile.avatar_emoji)}</div>
          </div>
        </div>
      </section>

      <section>
        <p className="mb-3 text-[13px] font-medium text-ink-400 uppercase tracking-wider">Notifications</p>
        <div className="rounded-2xl bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-500">
                {pushStatus === 'on' ? <Bell size={18} /> : <BellOff size={18} />}
              </div>
              <div>
                <p className="text-sm font-medium text-ink-800">Instant alerts</p>
                <p className="text-xs text-ink-400">Know the moment they message, even app closed</p>
              </div>
            </div>
            {pushStatus === 'on' ? (
              <span className="text-xs font-medium text-brand-500">On</span>
            ) : (
              <button onClick={handleEnablePush} disabled={pushStatus === 'checking' || pushStatus === 'unsupported'} className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-medium text-white disabled:opacity-40">
                {pushStatus === 'checking' ? 'Enabling...' : pushStatus === 'unsupported' ? 'Unsupported' : 'Enable'}
              </button>
            )}
          </div>
          {pushError && <p className="mt-3 text-xs text-error-500">{pushError}</p>}
        </div>
      </section>

      <section>
        <p className="mb-3 text-[13px] font-medium text-ink-400 uppercase tracking-wider">Pairing</p>
        <div className="overflow-hidden rounded-2xl bg-white shadow-soft">
          {confirmUnpair ? (
            <div className="px-5 py-4">
              <p className="text-sm text-ink-700">Unpair from your partner? Your shared timeline, chat, and photos stay put — you can re-pair anytime.</p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => setConfirmUnpair(false)} className="flex-1 rounded-xl bg-ink-50 py-2 text-xs font-medium text-ink-600">Never mind</button>
                <button onClick={handleUnpair} disabled={unpairing} className="flex-1 rounded-xl bg-error-500 py-2 text-xs font-medium text-white disabled:opacity-50">
                  {unpairing ? 'Unpairing...' : 'Yes, unpair'}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmUnpair(true)} className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-ink-50">
              <div>
                <span className="text-sm font-medium text-ink-700">Unpair</span>
                <p className="mt-0.5 text-xs text-ink-400">Stuck pairing, or need to reconnect fresh? Start here.</p>
              </div>
              <UserX size={18} className="text-ink-300" />
            </button>
          )}
        </div>
      </section>

      <section>
        <p className="mb-3 text-[13px] font-medium text-ink-400 uppercase tracking-wider">Account</p>
        <div className="overflow-hidden rounded-2xl bg-white shadow-soft">
          <div className="px-5 py-4">
            <p className="text-sm text-ink-500">Email</p>
            <p className="mt-0.5 text-sm text-ink-800">{profile.email}</p>
          </div>
          <div className="mx-5 h-px bg-ink-100" />
          <button onClick={handleSignOut} className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-error-50/50">
            <span className="text-sm font-medium text-error-600">Sign out</span>
            <LogOut size={18} className="text-error-400" />
          </button>
        </div>
      </section>

      <p className="text-center text-xs text-ink-300">Made with care for two.</p>
    </div>
  );
}
