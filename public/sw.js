// ---------------------------------------------------------------------------
// WAR WORLD service worker — the PWA's supply line.
// Strategy per lane:
//   · navigations (.html)  → network-first, cache fallback (fresh build wins,
//     offline still boots the last one you played)
//   · hashed /assets/      → cache-first (immutable by name — vite hashes them)
//   · /audio/ /art/ /models/ /icons/ → cache-first (the heavy, stable freight)
//   · everything else      → network, cache as it passes (stale-while-revalidate-ish)
// Registered by main.ts in PROD builds only — the dev server stays raw so HMR
// never fights a cache.
// ---------------------------------------------------------------------------
const VERSION = 'ww-v1';
const PRECACHE = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // same-origin freight only

  // navigations: network first — a fresh deploy must win over the cache
  if (req.mode === 'navigate' || url.pathname.endsWith('.html')) {
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })
        .catch(() => caches.match(req).then((hit) => hit ?? caches.match('/'))),
    );
    return;
  }

  // the heavy stable freight + vite's content-hashed bundles: cache first
  const cacheFirst = url.pathname.startsWith('/assets/') || url.pathname.startsWith('/audio/')
    || url.pathname.startsWith('/art/') || url.pathname.startsWith('/models/')
    || url.pathname.startsWith('/icons/');
  e.respondWith(
    caches.match(req).then((hit) => {
      const refetch = fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => hit); // offline: whatever we had
      return cacheFirst && hit ? hit : (hit ? refetch.catch(() => hit) : refetch);
    }),
  );
});
