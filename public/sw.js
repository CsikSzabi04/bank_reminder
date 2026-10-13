// Service worker (§12.5, §13.4). SW_VERSION: 1  ← frissítéshez léptesd (a böngésző a bájtkülönbséget figyeli)
// 🔴 Hitelesített HTML-t SOHA nem cache-elünk: a navigáció mindig hálózatról jön, csak offline tartalék az /offline.html.
const SW_VERSION = 1;
const STATIC_CACHE = `br-static-v${SW_VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS = new Set(["paid", "snooze"]);

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)));
  // nincs automatikus skipWaiting: új verziót csak a felhasználó jóváhagyásakor aktiválunk ('SKIP_WAITING')
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== STATIC_CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, push, külső képek: érintetlenül

  if (req.mode === "navigate") {
    // csak offline-tartalék; a válasz sosem kerül a cache-be
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }
  // hash-elt, megváltoztathatatlan statikus fájlok és az ikonok: cache-first
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
  // /api/*, RSC és minden más: nem nyúlunk hozzá
});

// A push-üzenet formátuma: ARCHITECTURE.md §12.6. MINDIG mutatunk értesítést (iOS/Safari követelmény).
self.addEventListener("push", (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {
    d = { title: "Bank Reminder", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(d.title || "Bank Reminder", {
        body: d.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-96.png",
        tag: d.tag, // azonos tag = felülír, nem halmozódik
        timestamp: d.ts || Date.now(),
        data: { url: d.url || "/dashboard", occId: d.occId, kind: d.kind },
        actions: (d.actions || []).slice(0, 2),
      });
      if (typeof d.badge === "number" && self.navigator.setAppBadge) {
        try {
          await (d.badge > 0 ? self.navigator.setAppBadge(d.badge) : self.navigator.clearAppBadge());
        } catch {
          /* a jelvény opcionális */
        }
      }
      // a nyitott ablakok frissíthetik az értesítésközpontot (§12.13)
      for (const client of await self.clients.matchAll({ type: "window" })) client.postMessage({ type: "push", kind: d.kind });
    })(),
  );
});

// Csak saját origin-en belüli relatív cél (a payload nem terelhet idegen oldalra)
function safeTarget(raw) {
  try {
    const u = new URL(raw || "/dashboard", self.location.origin);
    return u.origin === self.location.origin ? u.pathname + u.search : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const { url, occId } = event.notification.data || {};
  event.waitUntil(
    (async () => {
      if (occId && UUID.test(occId) && ACTIONS.has(event.action)) {
        try {
          const res = await fetch(`/api/occurrences/${occId}/${event.action}`, {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: "{}",
          });
          if (res.ok) return; // kész, nem nyitunk ablakot
        } catch {
          /* hiba (pl. lejárt session) → nyissuk meg az appot, hogy a felhasználó befejezhesse */
        }
      }
      const target = safeTarget(url);
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        if ("focus" in c) {
          await c.focus();
          if ("navigate" in c) await c.navigate(target);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const { key } = await (await fetch("/api/push/vapid-public-key")).json();
      const sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      await fetch("/api/push/resubscribe", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          oldEndpoint: event.oldSubscription && event.oldSubscription.endpoint,
        }),
      });
    })(),
  );
});
