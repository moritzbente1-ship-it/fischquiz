/* Offline-Cache: Seiten frisch aus dem Netz, Fotos aus dem Cache. Version hochzählen nach Änderungen. */
const V = "fischquiz-v2";
const KERN = ["./", "index.html", "css/app.css", "js/app.js", "species.js", "data/credits.js", "manifest.webmanifest", "icons/icon-180.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(KERN)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.includes("/img/")) {
    e.respondWith(caches.open(V).then(c => c.match(e.request).then(r => r || fetch(e.request).then(n => { if (n.ok) c.put(e.request, n.clone()); return n; }))));
  } else {
    e.respondWith(fetch(e.request).then(n => { if (n.ok) caches.open(V).then(c => c.put(e.request, n.clone())); return n; }).catch(() => caches.match(e.request)));
  }
});
