// Service worker: lets the app open offline and install to the home screen.
// App files are network-first (so updates show up straight away) with the cache as an offline fallback.
// Versioned CDN files (SortableJS, QR code, fonts) are cache-first. GitHub API calls are never cached.
const APP_CACHE = 'td-app-v5';
const CDN_CACHE = 'td-cdn-v1';

const APP_FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './icons/icon.svg',
  './icons/icon-192.png',
  './js/app.js',
  './js/constants.js',
  './js/store.js',
  './js/ui-state.js',
  './js/backend/github.js',
  './js/components/avatar.js',
  './js/components/categoryEditor.js',
  './js/components/connect.js',
  './js/components/dateMenu.js',
  './js/components/googleImport.js',
  './js/components/icons.js',
  './js/components/overlay.js',
  './js/components/quickAdd.js',
  './js/components/ring.js',
  './js/components/search.js',
  './js/components/settings.js',
  './js/components/taskEditor.js',
  './js/components/taskItem.js',
  './js/components/toast.js',
  './js/utils/dates.js',
  './js/utils/dom.js',
  './js/utils/googleTasks.js',
  './js/utils/quickadd.js',
  './js/utils/sortable.js',
  './js/utils/theme.js',
  './js/views/agenda.js',
  './js/views/auth.js',
  './js/views/category.js',
  './js/views/dashboard.js',
  './js/views/focus.js',
];

const CDN_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) => Promise.allSettled(APP_FILES.map((f) => cache.add(f))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('td-') && k !== APP_CACHE && k !== CDN_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req));
  } else if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(req));
  }
  // Everything else (including api.github.com sync traffic) goes straight to the network.
});

async function networkFirst(req) {
  const cache = await caches.open(APP_CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    throw err;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CDN_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}
