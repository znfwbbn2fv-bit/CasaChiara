'use strict';
const CACHE='casachiara-static-v2.3.0';
const ASSETS=['./','./index.html','./core.js','./app.js','./style.css','./manifest.webmanifest','./icon-192.png','./icon-512.png','./favicon.svg'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('casachiara-static-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request=event.request;
  if(request.method !== 'GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname))return;
  event.respondWith((async () => {
    const cache=await caches.open(CACHE);
    try {
      const response=await fetch(request);
      if(response.ok && (response.type==='basic'||response.type==='default')) {
        try {await cache.put(request,response.clone())}catch{}
      }
      return response;
    }catch(error){
      const cached=await cache.match(request,{ignoreSearch:true});
      if(cached)return cached;
      if(request.mode==='navigate'){
        const fallback=await cache.match('./index.html');
        if(fallback)return fallback;
      }
      return Response.error();
    }
  })());
});
