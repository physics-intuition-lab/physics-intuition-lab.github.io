/* Physics Intuition Lab — service worker (standalone deployment).
   Strategy: network-first for the main document so every deploy reaches users
   on their next open; cache-first for static assets (icons, images) with
   runtime caching for the rest, so the lab also opens offline. */
const CACHE = "intuition-lab-v1";
const CORE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
  "./assets/logo.png"
];
self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); })
  );
});
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});
self.addEventListener("fetch", function (e) {
  const req = e.request;
  if (req.method !== "GET") return;
  const accept = req.headers.get("accept") || "";
  const isDoc = req.mode === "navigate" || accept.indexOf("text/html") !== -1;
  if (isDoc) {
    // Network-first: a fresh deploy wins; the cached copy is only the offline fallback.
    e.respondWith(
      fetch(req).then(function (r) {
        const cp = r.clone();
        caches.open(CACHE).then(function (c) { c.put("./index.html", cp); });
        return r;
      }).catch(function () { return caches.match("./index.html"); })
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (r) {
        const cp = r.clone();
        caches.open(CACHE).then(function (c) { try { c.put(req, cp); } catch (_) {} });
        return r;
      });
    })
  );
});
