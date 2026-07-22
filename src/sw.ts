/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { NavigationRoute, registerRoute as registerNavRoute } from 'workbox-routing';
import { createHandlerBoundToURL } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

// Offline app-shell fallback: any navigation gets index.html from cache
// when there's no network, so the app itself always opens even offline.
registerNavRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), {
  denylist: [/^\/functions\//],
}));

registerRoute(
  ({ url }) => url.hostname === 'fonts.googleapis.com',
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-stylesheets',
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  })
);

registerRoute(
  ({ url }) => url.hostname === 'fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  })
);

self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()); });

// Best-effort background nudge (Chrome/Edge only, requires site engagement).
// This can't safely do an authenticated data-aware check from inside the
// service worker, so it's a gentle generic reminder — the rich, specific
// reminders (today's question, mood check, upcoming date) run via
// runReminderCheck() in the app itself every time it's opened, which is
// the reliable path regardless of periodic sync support.
self.addEventListener('periodicsync', (event: any) => {
  if (event.tag === 'bond-daily-check') {
    event.waitUntil(
      self.registration.showNotification('Bond', {
        body: "Don't forget to check in with your partner today 💕",
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: 'periodic-nudge',
      })
    );
  }
});

// --- Web Push: shows a notification the instant a message arrives, even
// if the app is fully closed. Requires the send-push edge function to be
// deployed (see PUSH_SETUP.md).
self.addEventListener('push', (event: PushEvent) => {
  let payload: { title?: string; body?: string; url?: string; image?: string } = {};
  try { payload = event.data?.json() ?? {}; } catch { /* non-JSON payload, ignore */ }

  const title = payload.title ?? 'Bond';
  const body = payload.body ?? 'Your partner sent you something 💌';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      image: payload.image,
      data: { url: payload.url ?? '/chat' },
    } as NotificationOptions & { image?: string })
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string })?.url ?? '/chat';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const existing = clients.find((c) => 'focus' in c);
      if (existing) return (existing as WindowClient).focus();
      return self.clients.openWindow(url);
    })
  );
});
