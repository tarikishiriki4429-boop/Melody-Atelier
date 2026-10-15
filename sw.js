// Melody Atelier v0.7.2: update cache without deleting existing project/audio storage.
const CACHE='melody-atelier-v0.7.2';
const ASSETS=['./','./index.html','./styles.css?v=070','./app.js?v=070','./chords.js?v=070','./manifest.webmanifest','./icon.svg','./reference-audio.js?v=070','./transcribe.js?v=072'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('melody-atelier-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(fetch(event.request).then(response=>{if(response.ok){const cloned=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,cloned));}return response;}).catch(()=>caches.match(event.request)));});
