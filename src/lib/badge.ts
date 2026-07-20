// Badging API: puts a small unread-count badge on the app icon itself —
// on the home screen, in the taskbar, or on the Android launcher icon once
// this is packaged as an APK. Supported on Chrome/Edge (Android, Windows,
// ChromeOS) and Safari (iOS 16.4+ installed PWAs). No-ops silently where
// unsupported instead of throwing.
export function setBadgeCount(count: number): void {
  const nav = navigator as Navigator & {
    setAppBadge?: (count?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  try {
    if (count > 0 && nav.setAppBadge) {
      void nav.setAppBadge(count);
    } else if (nav.clearAppBadge) {
      void nav.clearAppBadge();
    }
  } catch {
    // Badging API not supported on this platform — ignore.
  }
}
