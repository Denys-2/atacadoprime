/* Service Worker — Web Push de ofertas (Atacado Prime) */
self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { title: "Nova oferta", body: event.data ? event.data.text() : "" }; }
  const title = payload.title || "Atacado Prime";
  const opts = {
    body: payload.body || "",
    icon: payload.icon || "/apple-touch-icon.png",
    badge: "/favicon.ico",
    image: payload.image,
    data: { url: payload.url || "/", deliveryId: payload.deliveryId || null },
    tag: payload.tag || "oferta",
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = data.url || "/";
  event.waitUntil((async () => {
    if (data.deliveryId) {
      try {
        await fetch("/api/public/push/click", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deliveryId: data.deliveryId }),
          keepalive: true,
        });
      } catch {}
    }
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (c.url.includes(url)) return c.focus();
    }
    return self.clients.openWindow(url);
  })());
});
