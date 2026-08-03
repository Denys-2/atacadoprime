// One-release kill switch for the former Workbox app-shell service worker.
function isAtacadoPrimeAppCache(name) {
  return /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-|^html-nav$|^static-assets$|^supabase-images$/.test(name);
}

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil((async function () {
    try {
      var cacheNames = await caches.keys();
      var ownCaches = cacheNames.filter(isAtacadoPrimeAppCache);
      await Promise.all(ownCaches.map(function (name) { return caches.delete(name); }));
      await self.clients.claim();
      var clients = await self.clients.matchAll({ type: "window" });
      await Promise.all(clients.map(function (client) { return client.navigate(client.url); }));
    } finally {
      await self.registration.unregister();
    }
  })());
});