// Offline support: cache the app shell, serve from cache first, refresh in the background.
// Bump VERSION whenever you deploy changed files so phones pick up the new build.
const VERSION = 'studio-days-v0.20.0';
const SHELL = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'src/main.js', 'src/app/tracker.js', 'src/app/push.js', 'src/app/sound.js',
  'src/data/db.js', 'src/data/crypto.js', 'src/data/repository.js',
  'src/domain/dates.js', 'src/domain/habits.js', 'src/domain/reminders.js', 'src/domain/alarms.js', 'src/domain/library.js', 'src/domain/themes.js', 'src/domain/profile.js',
  'src/ui/views.js', 'src/ui/activities.js', 'src/ui/motion.js', 'src/ui/starry-night.js',
  'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/favicon-32.png',
];

// ---- notifications sent by the push server (reminders and alarms)
self.addEventListener('push', (e) => {
  let msg = { title: 'Archie Line', body: 'Time for a check-in.' };
  try { msg = { ...msg, ...e.data.json() }; } catch { /* keep the default text */ }
  e.waitUntil(self.registration.showNotification(msg.title, {
    body: msg.body,
    tag: msg.tag || 'studio-days',
    renotify: Boolean(msg.renotify), // alarms re-alert with sound on every repeat
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    data: { url: msg.url || './' },
  }));
});

// Opening a notification: focus the app and tell it which alarm to ring, or open it at that alarm.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || './', self.registration.scope).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (wins.length) {
      wins[0].postMessage({ type: 'open-url', url });
      return wins[0].focus();
    }
    return self.clients.openWindow(url);
  })());
});

self.addEventListener('install', (e) => {
  // cache: 'reload' bypasses the browser's HTTP cache, so a new version never precaches old files
  e.waitUntil(caches.open(VERSION)
    .then((c) => c.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const cached = await cache.match(e.request, { ignoreSearch: true });
    const network = fetch(e.request, { cache: 'no-cache' }).then((res) => { // revalidate with the server
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    }).catch(() => cached);
    return cached || network;
  }));
});
