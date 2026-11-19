const C='monk-v4',SHELL=['/monk-reader/','/monk-reader/index.html','/monk-reader/style.css','/monk-reader/app.js','/monk-reader/manifest.webmanifest','/monk-reader/icons/icon-192.png','/monk-reader/icons/icon-512.png','/monk-reader/data/posts.json','/monk-reader/data/categories.json','/monk-reader/data/facebook.json'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;
 const u=new URL(r.url);
 if(u.hostname==='public-api.wordpress.com'){ // network-first for API
  e.respondWith(fetch(r).then(res=>{const cl=res.clone();caches.open(C).then(c=>c.put(r,cl));return res}).catch(()=>caches.match(r)));return}
 e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{if(res.ok||res.type==='opaque'){const cl=res.clone();caches.open(C).then(c=>c.put(r,cl))}return res})));
});
