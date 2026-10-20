/* KomiK service worker. Bump VERSION on every release so the app can offer the update. */
const VERSION = 'v1.9.5';
const CORE = `komik-core-${VERSION}`;
const RUNTIME = 'komik-runtime';
const CORE_REQUIRED = ['./'];
const CORE_OPTIONAL = ['manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'favicon-32.png'];
const PRECACHE_ASSETS = [];
const CDN_HOSTS = ['cdn.tailwindcss.com', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const CDN_PRELOAD = [
  'https://cdn.tailwindcss.com/',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;900&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const core = await caches.open(CORE);
    await core.addAll(CORE_REQUIRED.map(u => new Request(u, { cache: 'reload' })));
    await Promise.allSettled(CORE_OPTIONAL.map(u => core.add(new Request(u, { cache: 'reload' }))));
    if (PRECACHE_ASSETS.length > 0) {
      await Promise.allSettled(PRECACHE_ASSETS.map(u => core.add(new Request(u, { cache: 'reload' }))));
    }
    const runtime = await caches.open(RUNTIME);
    await Promise.allSettled(CDN_PRELOAD.map(async (u) => runtime.put(u, await fetch(u, { mode: 'no-cors' }))));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n.startsWith('komik-core-') && n !== CORE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const d = event.data || {};
  if (d.type === 'SKIP_WAITING') self.skipWaiting();
  if (d.type === 'CACHE_URLS' && Array.isArray(d.urls)) {
    event.waitUntil((async () => {
      const runtime = await caches.open(RUNTIME);
      await Promise.allSettled(d.urls.filter(u => { try { return CDN_HOSTS.includes(new URL(u).hostname); } catch (e) { return false; } })
        .map(async (u) => { if (!(await runtime.match(u))) runtime.put(u, await fetch(u, { mode: 'no-cors' })); }));
    })());
  }
});

async function networkFirstPage(req) {
  try {
    const res = await fetch(req);
    if (res.ok && !res.redirected) (await caches.open(CORE)).put('./', res.clone());
    return res;
  } catch (e) {
    return (await caches.match('./')) || Response.error();
  }
}
async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(CORE)).put(req, res.clone());
  return res;
}
async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME);
  const hit = await cache.match(req);
  const net = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => null);
  return hit || (await net) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    event.respondWith(req.mode === 'navigate' ? networkFirstPage(req) : cacheFirst(req));
  } else if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(req));
  }
});
