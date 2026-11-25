/* Physics Intuition Lab — service worker (standalone deployment) v2.
   v1 cached EVERY non-document GET response forever under a cache name that
   never changed — including cross-origin Supabase API reads — so the app kept
   re-reading the first (empty/error) ledger responses it ever got and server
   progress never appeared, while writes (non-GET) passed through fine.
   v2 rules:
   - NEVER intercept cross-origin traffic (Supabase API/auth, CDNs): the
     network answers directly, always fresh.
   - Documents: network-first (every deploy reaches users on next open),
     cached copy only as the offline fallback.
   - Same-origin static assets only: cache-first with runtime caching.
   Activating v2 deletes the poisoned v1 cache. */
const CACHE = "intuition-lab-v2";
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
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return; /* API/auth/CDN: never intercept, never cache */
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
