// Service worker: działanie offline (stale-while-revalidate).
const CACHE = 'selekcjoner-v13';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/main.js', 'manifest.webmanifest', 'icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const cached = await c.match(e.request);
    const net = fetch(e.request).then((r) => { if (r && r.ok) c.put(e.request, r.clone()); return r; }).catch(() => cached);
    return cached || net;
  }));
});
