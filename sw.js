/* =====================================================
   PORTFOLIO — SERVICE WORKER
   Versioned shell cache + an update path the page can ask
   for (components.js shows the prompt and posts
   SKIP_WAITING). The site is static, so the cache is the
   whole shell: the document, its three stylesheets, the
   four scripts, the self-hosted fonts and the icon.

   Cache name is the version. Bump it on every deploy that
   changes a shell file; the activate step deletes every
   other `portfolio-` cache, so a bump is the whole
   migration.
   ===================================================== */
'use strict';

const VERSION = 'portfolio-v4';
const SHELL = [
  '/',
  '/style.css',
  '/components.css',
  '/script.js',
  '/components.js',
  '/dash-aggregate.js',
  '/medium-feed.js',
  '/apple-touch-icon.png',
  '/fonts/dmsans.woff2',
  '/fonts/dmsans-italic.woff2',
  '/fonts/inter.woff2'
];

self.addEventListener('install', (event) => {
  // Deliberately does NOT skipWaiting: the new worker must wait so the page can
  // offer the update bar. components.js posts SKIP_WAITING when Reload is
  // pressed, which is the only path that swaps the shell.
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Pages Functions and the dashboard endpoint are live reads: never cache them.
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    // Network first so a deploy is picked up; the cache is the offline fallback.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put('/', copy));
          return response;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
