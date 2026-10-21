const CACHE = "proar-shell-offline-day-v7";
const SHELL = ["/", "/manifest.webmanifest", "/manifest-system.webmanifest", "/brand/proar-mobile-192.png", "/brand/proar-mobile-512.png", "/brand/proar-system-192.png", "/brand/proar-system-512.png", "/icon-192.png", "/icon-512.png", "/proar-logo.png"];
async function prepareMobileShell(){
  const cache=await caches.open(CACHE),response=await fetch('/mobile',{cache:'no-store'});
  if(!response.ok)throw new Error('Mobile shell unavailable');
  const html=await response.clone().text();await cache.put('/mobile',response);
  const assets=[...new Set([...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(match=>match[1].replace(/&amp;/g,"&")).filter(path=>path.startsWith('/_next/static/')))];
  if(!assets.length)throw new Error('Mobile assets missing');
  let failed=false;
  for(let i=0;i<assets.length;i+=4)await Promise.all(assets.slice(i,i+4).map(async path=>{try{const asset=await fetch(path,{cache:'reload'});if(!asset.ok)throw new Error();await cache.put(path,asset);}catch{failed=true;}}));
  if(failed)throw new Error('Mobile assets incomplete');
}
self.addEventListener("install", event => event.waitUntil((async()=>{await caches.open(CACHE).then(cache=>cache.addAll(SHELL));try{await prepareMobileShell();}catch{}await self.skipWaiting();})()));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE && key.startsWith("proar-shell-")).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("message", event => { if (event.data === "SKIP_WAITING") self.skipWaiting(); if(event.data?.type === "PREPARE_MOBILE_SHELL")event.waitUntil(prepareMobileShell().then(()=>event.ports[0]?.postMessage({ok:true})).catch(()=>event.ports[0]?.postMessage({ok:false}))); });
self.addEventListener("fetch", event => {
  const pathname=new URL(event.request.url).pathname;
  if (event.request.method !== "GET" || pathname.startsWith("/api/") || pathname.startsWith("/mobile/api/")) return;
  const request = event.request.mode === "navigate" ? new Request(event.request, { cache: "no-store" }) : event.request;
  event.respondWith(fetch(request).then(response => {
    const copy = response.clone();
    if(response.ok)caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then(response => {if(response)return response;if(event.request.mode!=="navigate")return Response.error();const path=new URL(event.request.url).pathname;return caches.match(path==="/mobile"||path.startsWith("/mobile/")?"/mobile":"/");})));
});
