// This cache contains public app code only. Operational data is never cached
// by this worker: the signed-in app manages its own local copy and draft queue.
const CACHE = "proar-shell-offline-day-v8";
const SURFACES = new Set(["/", "/mobile"]);
const ASSET = /^\/(?:_next\/static\/|brand\/|(?:manifest(?:-system)?\.webmanifest|icon-192\.png|icon-512\.png|proar-logo\.png)$)/;
const NAVIGATION_TIMEOUT = 4500;

function knownAsset(url) {
  return url.origin === self.location.origin && ASSET.test(url.pathname);
}

async function prepareShell(path) {
  const cache = await caches.open(CACHE);
  const response = await fetch(path, {cache:"no-store", redirect:"error"});
  if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) throw new Error("App shell unavailable");
  const html = await response.clone().text();
  const assets = [...new Set([...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(match => {
    try { return new URL(match[1].replace(/&amp;/g, "&"), self.location.origin); } catch { return null; }
  }).filter(url => url && knownAsset(url)).map(url => url.href))];
  if (!assets.some(asset => new URL(asset).pathname.startsWith("/_next/static/"))) throw new Error("App assets missing");
  for (let i = 0; i < assets.length; i += 5) await Promise.all(assets.slice(i,i+5).map(async url => {
    if (await cache.match(url)) return;
    const asset = await fetch(url, {redirect:"error"});
    if (!asset.ok) throw new Error("App assets incomplete");
    await cache.put(url,asset);
  }));
  // Keep the previous usable HTML until the new version's assets are in place.
  await cache.put(path,response);
}

self.addEventListener("install", event => event.waitUntil(
  Promise.allSettled([...SURFACES].map(prepareShell)).then(() => self.skipWaiting())
));
self.addEventListener("activate", event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key !== CACHE && key.startsWith("proar-shell-")) await caches.delete(key);
  const cache = await caches.open(CACHE);
  for (const request of await cache.keys()) {
    const url = new URL(request.url);
    if (!knownAsset(url) && !(url.origin === self.location.origin && SURFACES.has(url.pathname) && !url.search)) await cache.delete(request);
  }
  await self.clients.claim();
})()));
self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") return void self.skipWaiting();
  const path = event.data?.type === "PREPARE_SYSTEM_SHELL" ? "/" : event.data?.type === "PREPARE_MOBILE_SHELL" ? "/mobile" : null;
  if (!path) return;
  event.waitUntil(prepareShell(path).then(() => event.ports[0]?.postMessage({ok:true})).catch(() => event.ports[0]?.postMessage({ok:false})));
});

async function navigate(request, path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(),NAVIGATION_TIMEOUT);
  let response;
  try {
    response = await fetch(request, {cache:"no-store", signal:controller.signal});
    if (response.status < 500) return response;
  } catch {} finally { clearTimeout(timer); }
  const cache = await caches.open(CACHE);
  return (await cache.match(path)) || response || Response.error();
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === "navigate" && SURFACES.has(url.pathname)) {
    event.respondWith(navigate(event.request,url.pathname));
    return;
  }
  if (!knownAsset(url)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const saved = await cache.match(event.request);
    if (saved && url.pathname.startsWith("/_next/static/")) return saved;
    try {
      const response = await fetch(event.request);
      if (response.ok && !response.redirected) await cache.put(event.request,response.clone()).catch(() => {});
      return response;
    } catch { return saved || Response.error(); }
  })());
});
