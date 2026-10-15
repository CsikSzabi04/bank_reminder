// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

// A service worker a valódi public/sw.js-ből fut, stubolt böngésző-környezetben: a cache-szabály (§13.4)
// és a push/értesítés-kattintás biztonsági viselkedése guard-teszttel védett.
const code = readFileSync(join(process.cwd(), "public/sw.js"), "utf8");
const ORIGIN = "https://app.test";
const UUID = "11111111-2222-4333-8444-555555555555";

function loadSw(fetchImpl: (...a: unknown[]) => Promise<unknown> = async () => ({ ok: true, clone: () => ({}) })) {
  const handlers: Record<string, (e: unknown) => void> = {};
  const cache = { addAll: vi.fn(async () => {}), put: vi.fn(async () => {}) };
  const caches = {
    open: vi.fn(async () => cache),
    match: vi.fn(async () => "CACHED"),
    keys: vi.fn(async () => ["br-static-v0", "br-static-v1", "other"]),
    delete: vi.fn(async (key: string) => key.length > 0),
  };
  const fetchMock = vi.fn(fetchImpl);
  const self = {
    location: { origin: ORIGIN },
    registration: { showNotification: vi.fn(async (title: string, options: Record<string, unknown>) => void [title, options]) },
    clients: { claim: vi.fn(async () => {}), matchAll: vi.fn(async () => []), openWindow: vi.fn(async () => {}) },
    navigator: {},
    skipWaiting: vi.fn(),
    addEventListener: (type: string, h: (e: unknown) => void) => (handlers[type] = h),
  };
  vm.runInNewContext(code, { self, caches, fetch: fetchMock, URL, console });
  const waited: Promise<unknown>[] = [];
  const base = { waitUntil: (p: Promise<unknown>) => waited.push(p) };
  return { handlers, cache, caches, self, fetchMock, waited, base };
}

const req = (url: string, init: { method?: string; mode?: string } = {}) => ({ url: `${ORIGIN}${url}`, method: init.method ?? "GET", mode: init.mode ?? "no-cors" });

async function dispatchFetch(sw: ReturnType<typeof loadSw>, request: ReturnType<typeof req> | { url: string; method: string; mode: string }) {
  let responded: Promise<unknown> | undefined;
  sw.handlers.fetch({ request, respondWith: (p: Promise<unknown>) => (responded = p) });
  return responded === undefined ? undefined : { value: await responded };
}

describe("service worker — cache-szabály (§13.4)", () => {
  it("telepítéskor az offline oldalt precache-eli, skipWaiting nélkül", async () => {
    const sw = loadSw();
    sw.handlers.install({ ...sw.base });
    await Promise.all(sw.waited);
    expect(sw.cache.addAll).toHaveBeenCalledWith(expect.arrayContaining(["/offline.html"]));
    expect(sw.self.skipWaiting).not.toHaveBeenCalled();
  });

  it("SKIP_WAITING üzenetre aktivál, mást figyelmen kívül hagy", () => {
    const sw = loadSw();
    sw.handlers.message({ data: "valami" });
    expect(sw.self.skipWaiting).not.toHaveBeenCalled();
    sw.handlers.message({ data: "SKIP_WAITING" });
    expect(sw.self.skipWaiting).toHaveBeenCalledTimes(1);
  });

  it("aktiváláskor a régi cache-ek törlődnek, az aktuális marad", async () => {
    const sw = loadSw();
    sw.handlers.activate({ ...sw.base });
    await Promise.all(sw.waited);
    expect(sw.caches.delete.mock.calls.map((c) => c[0]).sort()).toEqual(["br-static-v0", "other"]);
  });

  it("🔴 navigáció: hálózatról jön, sikeres válasz SOSEM kerül a cache-be", async () => {
    const sw = loadSw(async () => ({ ok: true, clone: () => ({}) }));
    await dispatchFetch(sw, req("/dashboard", { mode: "navigate" }));
    expect(sw.fetchMock).toHaveBeenCalled();
    expect(sw.cache.put).not.toHaveBeenCalled();
    expect(sw.caches.open).not.toHaveBeenCalled();
  });

  it("offline navigáció: az /offline.html jön a cache-ből", async () => {
    const sw = loadSw(async () => {
      throw new TypeError("offline");
    });
    const out = await dispatchFetch(sw, req("/reminders", { mode: "navigate" }));
    expect(out?.value).toBe("CACHED");
    expect(sw.caches.match).toHaveBeenCalledWith("/offline.html");
  });

  it("/_next/static és /icons: cache-first, találat nélkül a hálózatról és cache-be", async () => {
    const sw = loadSw(async () => ({ ok: true, clone: () => ({ cloned: true }) }));
    sw.caches.match.mockResolvedValueOnce(undefined as never);
    await dispatchFetch(sw, req("/_next/static/chunks/a.js"));
    await new Promise((r) => setTimeout(r));
    expect(sw.cache.put).toHaveBeenCalledTimes(1);

    const hit = loadSw();
    expect((await dispatchFetch(hit, req("/icons/icon-192.png")))?.value).toBe("CACHED");
    expect(hit.fetchMock).not.toHaveBeenCalled();
  });

  it("nem sikeres statikus válasz nem kerül a cache-be", async () => {
    const sw = loadSw(async () => ({ ok: false, clone: () => ({}) }));
    sw.caches.match.mockResolvedValueOnce(undefined as never);
    await dispatchFetch(sw, req("/_next/static/x.js"));
    await new Promise((r) => setTimeout(r));
    expect(sw.cache.put).not.toHaveBeenCalled();
  });

  it("érintetlen marad: /api/*, RSC/egyéb GET, nem-GET, idegen origin", async () => {
    const sw = loadSw();
    expect(await dispatchFetch(sw, req("/api/export"))).toBeUndefined();
    expect(await dispatchFetch(sw, req("/reminders?_rsc=abc"))).toBeUndefined();
    expect(await dispatchFetch(sw, req("/_next/static/a.js", { method: "POST" }))).toBeUndefined();
    expect(await dispatchFetch(sw, { url: "https://abc.supabase.co/rest/v1/x", method: "GET", mode: "cors" })).toBeUndefined();
    expect(sw.cache.put).not.toHaveBeenCalled();
  });
});

describe("service worker — push és értesítés-kattintás", () => {
  const push = async (sw: ReturnType<typeof loadSw>, data: unknown, raw?: string) => {
    sw.handlers.push({ ...sw.base, data: { json: () => (raw !== undefined ? JSON.parse(raw) : data), text: () => raw ?? "" } });
    await Promise.all(sw.waited);
  };

  it("MINDIG mutat értesítést; max. 2 művelet; a tag/url a payloadból", async () => {
    const sw = loadSw();
    await push(sw, {
      title: "Netflix — holnap esedékes",
      body: "2 300 Ft",
      tag: "rem-abc",
      url: "/reminders/x",
      occId: UUID,
      actions: [{ action: "paid" }, { action: "snooze" }, { action: "x" }],
    });
    const [title, options] = sw.self.registration.showNotification.mock.calls[0];
    expect(title).toBe("Netflix — holnap esedékes");
    expect(options.tag).toBe("rem-abc");
    expect((options.actions as unknown[]).length).toBe(2);
  });

  it("hibás JSON-payload sem némítja el: alap-címmel mutat", async () => {
    const sw = loadSw();
    await push(sw, null, "ez nem json");
    expect(sw.self.registration.showNotification.mock.calls[0][0]).toBe("Bank Reminder");
  });

  it("kattintás „Kifizettem”-re: POST a saját API-ra, siker után nem nyit ablakot", async () => {
    const sw = loadSw(async () => ({ ok: true }));
    sw.handlers.notificationclick({ ...sw.base, action: "paid", notification: { close: vi.fn(), data: { occId: UUID, url: "/x" } } });
    await Promise.all(sw.waited);
    expect(sw.fetchMock).toHaveBeenCalledWith(`/api/occurrences/${UUID}/paid`, expect.objectContaining({ method: "POST", credentials: "include" }));
    expect(sw.self.clients.openWindow).not.toHaveBeenCalled();
  });

  it("nem UUID azonosítóval és ismeretlen művelettel nincs API-hívás (útvonal-injektálás ellen)", async () => {
    for (const [action, occId] of [["paid", "../../admin"], ["paid", `${UUID}/../x`], ["delete", UUID]] as const) {
      const sw = loadSw();
      sw.handlers.notificationclick({ ...sw.base, action, notification: { close: vi.fn(), data: { occId } } });
      await Promise.all(sw.waited);
      expect(sw.fetchMock, `${action} ${occId}`).not.toHaveBeenCalled();
    }
  });

  it("a „Kifizettem/Halaszt” gomb csak számla-értesítésnél él: keret-riasztás / bank-lejárat / tipp mellett nincs API-hívás, az app megnyílik", async () => {
    for (const kind of ["budget", "bank_consent", "tip", "news", "digest", "system"]) {
      const sw = loadSw();
      sw.handlers.notificationclick({ ...sw.base, action: "paid", notification: { close: vi.fn(), data: { kind, occId: UUID, url: "/bank" } } });
      await Promise.all(sw.waited);
      expect(sw.fetchMock, kind).not.toHaveBeenCalled();
      expect(sw.self.clients.openWindow, kind).toHaveBeenCalledWith("/bank");
    }
    for (const kind of ["reminder", "overdue"]) {
      const sw = loadSw(async () => ({ ok: true }));
      sw.handlers.notificationclick({ ...sw.base, action: "snooze", notification: { close: vi.fn(), data: { kind, occId: UUID, url: "/x" } } });
      await Promise.all(sw.waited);
      expect(sw.fetchMock, kind).toHaveBeenCalledWith(`/api/occurrences/${UUID}/snooze`, expect.anything());
    }
  });

  it("hibás API-válasz esetén megnyitja az appot (a felhasználó befejezheti)", async () => {
    const sw = loadSw(async () => ({ ok: false }));
    sw.handlers.notificationclick({ ...sw.base, action: "paid", notification: { close: vi.fn(), data: { occId: UUID, url: "/dashboard" } } });
    await Promise.all(sw.waited);
    expect(sw.self.clients.openWindow).toHaveBeenCalledWith("/dashboard");
  });

  it("a payload url-je nem terelhet idegen oldalra: csak saját origin, különben /dashboard", async () => {
    for (const [url, expected] of [["https://evil.example/phish", "/dashboard"], ["//evil.example", "/dashboard"], ["/reminders/1?occ=2", "/reminders/1?occ=2"]]) {
      const sw = loadSw();
      sw.handlers.notificationclick({ ...sw.base, action: "", notification: { close: vi.fn(), data: { url } } });
      await Promise.all(sw.waited);
      expect(sw.self.clients.openWindow, url).toHaveBeenCalledWith(expected);
    }
  });
});
