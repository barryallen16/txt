// txt PWA service worker
// Caches the app shell so the payment-request web UI works offline.
// SMS send/receive is native-only and is not available on the web.
//
// Every cache path is relative and resolves against this file's location, so
// the site works both at a repo subpath (github.com/user/repo -> /txt/) and
// at a domain root. The build stamps CACHE_NAME with a content hash, so a new
// deploy replaces the cached shell instead of serving it forever.

const CACHE_NAME = "txt-vbcf33210d782";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./favicon.ico",
];

// Install: cache the app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        ASSETS.map(async (asset) => {
          try {
            const response = await fetch(asset);
            if (response.ok) {
              await cache.put(asset, response);
            }
          } catch (err) {
            console.warn("PWA SW: failed to cache", asset, err);
          }
        })
      );
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches (any cache name we did not just stamp)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch:
// - navigations go network-first (updates reach users on the next visit),
//   falling back to the cached shell when offline
// - other same-origin GETs are cache-first, refilled in the background
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok && event.request.method === "GET") {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then(
            (cached) => cached || caches.match("./index.html")
          )
        )
    );
    return;
  }

  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
