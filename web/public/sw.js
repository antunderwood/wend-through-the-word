// The service worker (decision 228). Chrome needs one with a fetch handler before it installs the
// site as an app. It keeps the app shell, never the data: /data is not touched, so index.json keeps
// its five minutes and a data version is always the one index.json names. Hashed files under
// /assets never change, so they are cached for good; pages go to the network first and fall back to
// the last copy only when offline.
const CACHE = "wend-shell-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/data/")) return;

  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
  } else if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((cache) => cache.put(req, res.clone()));
          return res;
        })
        .catch(async () => (await caches.match(req)) ?? (await caches.match("/")) ?? Response.error()),
    );
  }
});
