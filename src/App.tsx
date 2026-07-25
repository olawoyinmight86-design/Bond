import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { supabase } from './lib/supabase';
import { startAutoSync } from './lib/syncEngine';
import { BraceletLogo } from './components/BraceletLogo';
import AuthScreen from './screens/AuthScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import PairingScreen from './screens/PairingScreen';
import DashboardScreen from './screens/DashboardScreen';
import TimelineScreen from './screens/TimelineScreen';
import ChatScreen from './screens/ChatScreen';
import PhotoboothScreen from './screens/PhotoboothScreen';
import SettingsScreen from './screens/SettingsScreen';
import GamesScreen from './screens/GamesScreen';
import BucketListScreen from './screens/BucketListScreen';
import LoveLettersScreen from './screens/LoveLettersScreen';
import AppShell from './components/AppShell';
import PartnerActivityBubble from './components/PartnerActivityBubble';
import { PartnerActivityProvider } from './lib/partnerActivity';

export default function App() {
  const { init, initialized, loading, session, profile } = useAuth();

  useEffect(() => { init(); }, [init]);
  useEffect(() => startAutoSync(), []);
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'mark-read' && event.data.messageId) {
        supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', event.data.messageId).then(() => {});
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);

  if (!initialized || loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink-50">
        <BraceletLogo className="h-14 w-14 animate-pulse-soft" glow />
        <div className="font-display text-lg text-ink-400">Bond</div>
      </div>
    );
  }

  if (!session) {
    return <Routes><Route path="*" element={<AuthScreen />} /></Routes>;
  }

  if (!profile?.onboarding_complete) {
    return <Routes><Route path="*" element={<OnboardingScreen />} /></Routes>;
  }

  if (!profile?.paired_with) {
    return <Routes><Route path="*" element={<PairingScreen />} /></Routes>;
  }

  return (
    <PartnerActivityProvider>
      <AppShell>
        <Routes>
          <Route path="/" element={<DashboardScreen />} />
          <Route path="/timeline" element={<TimelineScreen />} />
          <Route path="/chat" element={<ChatScreen />} />
          <Route path="/photobooth" element={<PhotoboothScreen />} />
          <Route path="/games" element={<GamesScreen />} />
          <Route path="/bucket-list" element={<BucketListScreen />} />
          <Route path="/love-letters" element={<LoveLettersScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
      <PartnerActivityBubble />
    </PartnerActivityProvider>
  );
}
