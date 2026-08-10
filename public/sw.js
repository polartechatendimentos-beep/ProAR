const CACHE = "proar-shell-v4";
const SHELL = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/proar-logo.png"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("message", event => { if (event.data === "SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || new URL(event.request.url).pathname.startsWith("/api/")) return;
  const request = event.request.mode === "navigate" ? new Request(event.request, { cache: "no-store" }) : event.request;
  event.respondWith(fetch(request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then(response => response || caches.match("/"))));
});
