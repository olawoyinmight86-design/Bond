// Push notifications (VAPID) need a deployed server function and only fire
// while the OS can wake the browser for a push event. This is a second,
// independent path that needs none of that setup: local notifications fire
// straight from this device using the Notification API, checked whenever
// the app is opened or foregrounded. Periodic Background Sync is layered on
// top as a best-effort extra (Chrome/Edge only, and only after enough
// engagement that the browser trusts the site) — when it's not available,
// the foreground check alone still delivers reminders reliably every time
// the app is opened, which covers the vast majority of real usage.

const ENABLED_KEY = 'bond_local_reminders_enabled';
const LAST_SHOWN_KEY = 'bond_reminder_last_shown';

export function localRemindersSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

export function localRemindersEnabled(): boolean {
  return localRemindersSupported() && Notification.permission === 'granted' && localStorage.getItem(ENABLED_KEY) === '1';
}

export async function enableLocalReminders(): Promise<{ ok: boolean; reason?: string }> {
  if (!localRemindersSupported()) return { ok: false, reason: 'Not supported on this browser' };
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'Permission denied' };
  localStorage.setItem(ENABLED_KEY, '1');
  await tryRegisterPeriodicSync();
  return { ok: true };
}

export function disableLocalReminders() {
  localStorage.setItem(ENABLED_KEY, '0');
}

async function tryRegisterPeriodicSync() {
  try {
    const reg = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration & { periodicSync?: { register: (tag: string, opts: { minInterval: number }) => Promise<void> } };
    if (!reg.periodicSync) return;
    const status = await (navigator as any).permissions?.query({ name: 'periodic-background-sync' });
    if (status?.state === 'granted') {
      await reg.periodicSync.register('bond-daily-check', { minInterval: 20 * 60 * 60 * 1000 });
    }
  } catch {
    // Not supported on this browser/device — the foreground check below is
    // the reliable path regardless, so this is a pure bonus when it works.
  }
}

async function showLocal(title: string, body: string, tag: string) {
  if (!localRemindersEnabled()) return;
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification(title, { body, icon: '/icon-192.png', badge: '/icon-192.png', tag });
}

export type ReminderContext = {
  hasUnansweredPrompt: boolean;
  moodLoggedToday: boolean;
  upcomingDateTitle: string | null;
  upcomingDateInDays: number | null;
};

/** Call this once per app foreground/open — cheap, and only actually shows
 * a notification the first time each condition becomes true on a given day. */
export async function runReminderCheck(ctx: ReminderContext) {
  if (!localRemindersEnabled()) return;
  const today = new Date().toISOString().slice(0, 10);
  const shown: Record<string, string> = JSON.parse(localStorage.getItem(LAST_SHOWN_KEY) || '{}');

  if (ctx.hasUnansweredPrompt && shown.prompt !== today) {
    await showLocal('Bond', "Today's question is waiting for your answer 💬", 'daily-prompt');
    shown.prompt = today;
  }
  if (!ctx.moodLoggedToday && shown.mood !== today) {
    await showLocal('Bond', 'How are you feeling today? Log your mood 🌙', 'mood-check');
    shown.mood = today;
  }
  if (ctx.upcomingDateTitle && ctx.upcomingDateInDays !== null && ctx.upcomingDateInDays <= 3) {
    const key = `date-${ctx.upcomingDateTitle}`;
    if (shown[key] !== today) {
      const days = ctx.upcomingDateInDays;
      await showLocal('Bond', `${ctx.upcomingDateTitle} ${days === 0 ? 'is today' : days === 1 ? 'is tomorrow' : `in ${days} days`} 💕`, 'anniversary');
      shown[key] = today;
    }
  }

  localStorage.setItem(LAST_SHOWN_KEY, JSON.stringify(shown));
}
