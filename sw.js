// DrowsyGuard service worker
// v2: fixed mismatch — MediaPipe scripts are requested by <script crossorigin="anonymous">
// (i.e. CORS mode), so they must be fetched/cached the same way here. Caching them
// with mode:'no-cors' produces an opaque response that the browser silently rejects
// when it doesn't match how the page actually requested the script — that was the
// "FaceMesh is not defined" bug after install.
// v3: fixed app.js — early noisy/zero EAR readings right after camera start could
// rack up enough "closed eye" frames to fire a false CRITICAL alert within ~1s, and
// starting Calibration didn't clear an alert already in progress, so the red overlay
// got stuck behind the calibration modal.
// v4: fixed the UPDATE PROBLEM — v2/v3 cached the app shell (index.html/app.js/etc.)
// cache-first, so a fixed app.js could sit on GitHub while an installed phone kept
// silently running the old broken one forever, with no visible error. Local app-shell
// files are now network-first (always try to fetch the latest, fall back to cache only
// if offline), and the page force-reloads once whenever a new service worker takes
// over, so a fix actually reaches the screen instead of hiding behind old cache.
// Bump CACHE_VERSION on any future change — the activate step below deletes every
// cache that doesn't match the current version, so nothing stale can linger.

const CACHE_VERSION = 'v4';
const CACHE_NAME = `drowsyguard-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png'
];

// Requested in CORS mode to match the crossorigin="anonymous" script tags in index.html
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    // Best-effort: cache CDN assets with mode 'cors' so the cached Response type
    // is 'cors', matching what the page actually requests at runtime.
    await Promise.all(CDN_ASSETS.map(async (url) => {
      try {
        const resp = await fetch(url, { mode: 'cors' });
        if (resp.ok) await cache.put(url, resp.clone());
      } catch (e) {
        // offline at install time — will be cached opportunistically on first
        // successful online fetch via the fetch handler below
      }
    }));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  const isCdn = CDN_ASSETS.includes(req.url) || url.hostname === 'cdn.jsdelivr.net';

  if (isCdn) {
    // Cache-first, but always fetch in the SAME mode the page used (cors),
    // never no-cors — that mismatch was the original bug.
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;
      try {
        const resp = await fetch(req); // preserves the request's own mode (cors)
        if (resp && resp.ok) cache.put(req, resp.clone());
        return resp;
      } catch (e) {
        return cached || Response.error();
      }
    })());
    return;
  }

  // App shell (index.html, app.js, style.css, etc.): NETWORK-FIRST. Always try to
  // get the latest file from GitHub Pages first — that's the whole point, so a fix
  // you push actually shows up next load. Cache is only a fallback for when there's
  // truly no connection (real offline use), never the default source.
  if (req.method === 'GET' && url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const resp = await fetch(req, { cache: 'no-store' });
        if (resp && resp.ok) cache.put(req, resp.clone());
        return resp;
      } catch (e) {
        const cached = await cache.match(req);
        return cached || Response.error();
      }
    })());
  }
});
