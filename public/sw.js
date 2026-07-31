/**
 * Up2Eng Dictionary — Service Worker
 *
 * This is a hand-written SW (no Workbox / no build-time manifest injection) because
 * the project doesn't use a vite PWA plugin, so hashed asset filenames aren't known
 * ahead of time. Strategy:
 *
 *   1. App shell (index.html, manifest, icons, offline fallback) — precached on install.
 *   2. Same-origin built assets (/assets/*.js, *.css, images) — cache-first, populated
 *      opportunistically as the user visits pages, so repeat visits load instantly and
 *      the app keeps working offline after the first successful visit.
 *   3. Navigation requests (SPA routes) — network-first, falling back to the cached
 *      index.html (so client-side routing still works offline), then to offline.html.
 *   4. Dictionary/thesaurus API calls (Merriam-Webster, Free Dictionary API, Wiktionary,
 *      Datamuse, Wikipedia, MW audio) — stale-while-revalidate: an already-cached response
 *      is returned instantly while a fresh copy is fetched in the background and stored
 *      for next time. This is what makes *repeat* online word look-ups feel instant even
 *      before IndexedDB is consulted, and keeps recently-looked-up words available if the
 *      network briefly drops.
 *
 * Bump SW_VERSION whenever caching behavior changes so old caches get cleaned up.
 */

const SW_VERSION = 'v3';
const STATIC_CACHE = `up2eng-static-${SW_VERSION}`;
const RUNTIME_CACHE = `up2eng-runtime-${SW_VERSION}`;
const API_CACHE = `up2eng-api-${SW_VERSION}`;
const ALL_CACHES = [STATIC_CACHE, RUNTIME_CACHE, API_CACHE];

// Base path this SW controls, e.g. "/" on a custom domain or "/up2eng-dictionary/" on
// GitHub Pages project sites. Derived at runtime so this file needs no build step.
const BASE = self.registration.scope.replace(self.location.origin, '');

const APP_SHELL_URLS = [
  BASE,
  `${BASE}index.html`,
  `${BASE}manifest.json`,
  `${BASE}offline.html`,
  `${BASE}icon.svg`,
  `${BASE}icon-192.png`,
  `${BASE}icon-512.png`,
  `${BASE}icon-192-maskable.png`,
  `${BASE}icon-512-maskable.png`,
  `${BASE}favicon-32.png`,
  `${BASE}favicon-16.png`,
  `${BASE}favicon.ico`,
];

// Hosts we treat as "dictionary API" traffic for stale-while-revalidate caching.
const API_HOSTS = [
  'www.dictionaryapi.com', // Merriam-Webster Dictionary + Thesaurus
  'api.dictionaryapi.dev', // Free Dictionary API
  'en.wiktionary.org',
  'en.wikipedia.org',
  'api.datamuse.com',
  'media.merriam-webster.com', // pronunciation audio
];

const MAX_API_CACHE_ENTRIES = 300;

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // Cache each shell URL independently so one 404 (e.g. an icon that wasn't
      // generated) doesn't abort the whole install.
      await Promise.all(
        APP_SHELL_URLS.map(url =>
          cache.add(url).catch(err => console.warn('[SW] Failed to precache', url, err))
        )
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(name => name.startsWith('up2eng-') && !ALL_CACHES.includes(name))
          .map(name => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/** Trims a cache down to `maxEntries` by deleting the oldest inserted entries. */
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  const excess = keys.length - maxEntries;
  for (let i = 0; i < excess; i++) {
    await cache.delete(keys[i]);
  }
}

/** Cache-first strategy for same-origin static build assets. */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const fallback = await caches.match(`${BASE}index.html`);
    if (fallback) return fallback;
    throw err;
  }
}

/** Network-first strategy for navigation (SPA route) requests. */
async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(`${BASE}index.html`, response.clone());
    }
    return response;
  } catch {
    const cachedShell = await caches.match(`${BASE}index.html`);
    if (cachedShell) return cachedShell;
    const offline = await caches.match(`${BASE}offline.html`);
    if (offline) return offline;
    return new Response('You are offline.', { status: 503, statusText: 'Offline' });
  }
}

/** Stale-while-revalidate for dictionary API calls: instant cached response + background refresh. */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(API_CACHE);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then(response => {
      if (response && response.ok) {
        cache.put(request, response.clone());
        trimCache(API_CACHE, MAX_API_CACHE_ENTRIES);
      }
      return response;
    })
    .catch(() => null);

  // Return cached instantly if we have it; otherwise wait for the network.
  return cached || (await networkFetch) || new Response(JSON.stringify({ title: 'Offline', message: 'No cached data for this request.' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 1. Navigation requests (SPA route changes / full page loads)
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // 2. Dictionary/thesaurus/audio API calls — stale-while-revalidate for speed + resilience
  if (API_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // 3. Same-origin static assets (JS/CSS/images/fonts under this app's scope) — cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 4. Everything else (other cross-origin requests) — just pass through to the network.
});
