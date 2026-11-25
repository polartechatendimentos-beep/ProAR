const CACHE = "proar-shell-v6";
const APP_ROUTES = ["/", "/mobile"];
const SHELL_FILES = [
  "/offline.html",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/proar-logo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all([...APP_ROUTES, ...SHELL_FILES].map(async (url) => {
      try {
        const response = await fetch(url, { cache: "reload" });
        if (response.ok) await cache.put(url, response);
      } catch {
        // A failed optional route must not prevent the worker from installing.
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith("proar-shell-") && key !== CACHE)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") void self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        // Cache only the public application shell. Never cache page responses
        // that may contain account or customer data.
        if (response.ok && APP_ROUTES.includes(url.pathname)) {
          const cache = await caches.open(CACHE);
          await cache.put(url.pathname, response.clone());
        }
        return response;
      } catch {
        const cache = await caches.open(CACHE);
        const cachedRoute = await cache.match(url.pathname);
        if (cachedRoute) return cachedRoute;
        return (await cache.match("/offline.html")) || Response.error();
      }
    })());
    return;
  }

  // Cache versioned Next.js chunks and public PWA assets. API responses,
  // uploads, and other potentially private resources always use the network.
  const isPublicAsset = url.pathname.startsWith("/_next/static/") ||
    ["/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/proar-logo.png", "/offline.html"].includes(url.pathname);
  if (!isPublicAsset) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch {
      return (await cache.match(url.pathname)) || Response.error();
    }
  })());
});
