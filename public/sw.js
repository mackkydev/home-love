const CACHE_NAME = "baanjai-shell-v1";
const APP_SHELL = ["/", "/manifest.webmanifest", "/icon.svg"];
const IS_LOCAL_DEV = self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1";

self.addEventListener("install", (event) => {
  if (!IS_LOCAL_DEV) event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => IS_LOCAL_DEV || key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (IS_LOCAL_DEV) return;
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => {
      const copy = response.clone();
      void caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
      return response;
    }).catch(() => caches.match("/")));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) { const copy = response.clone(); void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)); }
      return response;
    })));
  }
});
