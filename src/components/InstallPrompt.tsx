import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISSED_KEY = 'bond_install_dismissed';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;
    if (localStorage.getItem(DISMISSED_KEY)) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setVisible(false);
  };

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="mx-5 mb-3 flex items-center gap-3 rounded-2xl bg-ink-900 px-4 py-3 text-white shadow-lift animate-slide-up">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-surface/10">
        <Download size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Install Bond</p>
        <p className="text-xs text-white/60">Get the full-screen app — works offline, opens instantly</p>
      </div>
      <button onClick={install} className="flex-shrink-0 rounded-lg bg-surface px-3 py-1.5 text-xs font-semibold text-ink-900">Install</button>
      <button onClick={dismiss} className="flex-shrink-0 text-white/40"><X size={16} /></button>
    </div>
  );
}
