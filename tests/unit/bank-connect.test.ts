import { describe, expect, it, vi } from "vitest";
import { accountKind, parseAccounts } from "@/lib/bank/accounts";
import { bankFlashUrl, parseCallbackParams } from "@/lib/bank/callback";
import { connectionHealth, parseConnections } from "@/lib/bank/connections";
import { readBankFlash } from "@/lib/bank/flash";
import { callBankFunction, type FunctionsClient } from "@/lib/bank/functions";
import {
  disconnectCore,
  finishConnectionCore,
  listAspspsCore,
  parseRefreshOutcome,
  safeAuthUrl,
  startConnectionCore,
} from "@/lib/bank/service";

const UUID = "0b3f8a55-62c1-4a6e-9c1b-1f2d3e4a5b6c";

// Fake kliens: a megadott választ adja; `error` esetén a supabase-js FunctionsHttpError alakját (context = Response) utánozza
const client = (result: { data?: unknown; error?: unknown } | Error): FunctionsClient & { calls: unknown[] } => {
  const calls: unknown[] = [];
  return {
    calls,
    functions: {
      invoke: async (name, options) => {
        calls.push({ name, body: options.body });
        if (result instanceof Error) throw result;
        return { data: result.data ?? null, error: result.error ?? null };
      },
    },
  };
};
const httpError = (status: number, body?: unknown) => ({
  context: { status, json: async () => (body === undefined ? Promise.reject(new Error("not json")) : body) },
});

describe("parseCallbackParams (A-40: ?state&code, hibánál ?state&error)", () => {
  const p = (q: string) => parseCallbackParams(new URLSearchParams(q));

  it("siker: érvényes code + state", () => {
    expect(p(`code=ef69c617-c894-46bf-9186-4f9e4d522884&state=90b5c609-a1f5-4140-80e5-e4349b91b7cb`)).toEqual({
      kind: "ok",
      code: "ef69c617-c894-46bf-9186-4f9e4d522884",
      state: "90b5c609-a1f5-4140-80e5-e4349b91b7cb",
    });
  });

  it("hiányzó vagy furcsa karaktert tartalmazó paraméter → invalid_callback (nem jut tovább a szerverre)", () => {
    for (const q of ["", "code=abcdefgh", "state=abcdefgh", "code=a&state=b", "code=<script>alert(1)</script>&state=abcdefgh12", `code=${"a".repeat(300)}&state=abcdefgh12`, "code=abc def gh&state=abcdefgh12"]) {
      expect(p(q), q).toEqual({ kind: "error", reason: "invalid_callback" });
    }
  });

  it("a bank hibája: megtagadás külön, minden más „a bank hibázott”; a hiba a code-ot felülírja", () => {
    expect(p("state=abcdefgh12&error=access_denied")).toEqual({ kind: "error", reason: "bank_denied" });
    expect(p("state=abcdefgh12&error=ACCESS_DENIED")).toEqual({ kind: "error", reason: "bank_denied" });
    expect(p("state=abcdefgh12&error=server_error")).toEqual({ kind: "error", reason: "bank_error" });
    expect(p("code=abcdefgh12&state=abcdefgh12&error=server_error")).toEqual({ kind: "error", reason: "bank_error" });
  });

  it("a Next searchParams objektum-alakját is érti (tömb esetén az első érték)", () => {
    expect(parseCallbackParams({ code: ["abcdefgh12", "x"], state: "abcdefgh34" })).toEqual({ kind: "ok", code: "abcdefgh12", state: "abcdefgh34" });
  });
});

describe("visszajelzés az URL-ben (nem tükrözünk vissza tetszőleges szöveget)", () => {
  it("az átirányítás a /bank?section=overview…-ra megy, a code/state nélkül", () => {
    expect(bankFlashUrl({ kind: "connected" })).toBe("/bank?section=overview&result=connected");
    expect(bankFlashUrl({ kind: "error", reason: "state_invalid" })).toBe("/bank?section=overview&result=error&reason=state_invalid");
  });

  it("csak ismert érték olvasható vissza; ismeretlen ok → unknown, ismeretlen result → nincs", () => {
    expect(readBankFlash({ result: "connected" })).toEqual({ kind: "connected" });
    expect(readBankFlash({ result: "error", reason: "state_expired" })).toEqual({ kind: "error", reason: "state_expired" });
    expect(readBankFlash({ result: "error", reason: "<img src=x onerror=alert(1)>" })).toEqual({ kind: "error", reason: "unknown" });
    expect(readBankFlash({ result: "hacked" })).toBeNull();
    expect(readBankFlash({})).toBeNull();
  });
});

describe("számlák: 3 típus, nincs feltételezett IBAN (A-40)", () => {
  // az éles Revolut-kör szerkezete: HUF folyószámla (IBAN), USD folyószámla (UGYANAZ az IBAN), HUF megtakarítás (IBAN nélkül)
  const raw = [
    { identification_hash: "h-huf", cash_account_type: "CACC", currency: "HUF", iban_last4: "6581", name: "Fő számla" },
    { identification_hash: "h-usd", cash_account_type: "CACC", currency: "USD", iban_last4: "6581" },
    { identification_hash: "h-sav", cash_account_type: "SVGS", currency: "HUF", name: "Megtakarítás" },
  ];

  it("mindhárom számla külön kulccsal megmarad (azonos IBAN nem olvasztja össze őket)", () => {
    const accounts = parseAccounts(raw);
    expect(accounts.map((a) => a.key)).toEqual(["h-huf:HUF", "h-usd:USD", "h-sav:HUF"]);
    expect(accounts.map((a) => a.kind)).toEqual(["current", "current", "savings"]);
    expect(accounts.map((a) => a.currency)).toEqual(["HUF", "USD", "HUF"]);
    expect(accounts.map((a) => a.ibanLast4)).toEqual(["6581", "6581", null]);
  });

  it("azonos identification_hash + eltérő pénznem is két külön számla (egyedi React-kulccsal)", () => {
    const accounts = parseAccounts([
      { identification_hash: "same", cash_account_type: "CACC", currency: "HUF" },
      { identification_hash: "same", cash_account_type: "CACC", currency: "USD" },
    ]);
    expect(accounts).toHaveLength(2);
    expect(new Set(accounts.map((a) => a.key)).size).toBe(2);
  });

  it("teljes IBAN esetén is csak az utolsó 4 jegy marad", () => {
    const [a] = parseAccounts([{ uid: "u1", currency: "huf", iban: "HU97 3020 0014 1991 3410 9007 6581" }]);
    expect(a.ibanLast4).toBe("6581");
    expect(JSON.stringify(a)).not.toContain("3020");
  });

  it("kulcs vagy érvényes pénznem nélküli elem, és a nem-tömb kimarad; ismeretlen típus → other", () => {
    expect(parseAccounts([{ currency: "HUF" }, { uid: "u", currency: "FORINT" }, null, "x", { uid: "u2", currency: "EUR", cash_account_type: "XYZ" }])).toEqual([
      { key: "u2:EUR", kind: "other", currency: "EUR", name: null, ibanLast4: null, syncEnabled: null },
    ]);
    expect(parseAccounts(undefined)).toEqual([]);
    expect(parseAccounts({ a: 1 })).toEqual([]);
  });

  it("a típus-kód kis/nagybetűre érzéketlen; a sync-jelző csak valódi logikai érték", () => {
    expect(accountKind("cacc")).toBe("current");
    expect(accountKind(undefined)).toBe("other");
    expect(parseAccounts([{ uid: "u", currency: "HUF", sync_enabled: "yes" }])[0].syncEnabled).toBeNull();
    expect(parseAccounts([{ uid: "u", currency: "HUF", sync_enabled: false }])[0].syncEnabled).toBe(false);
  });
});

describe("kapcsolatok és állapotuk", () => {
  const row = (over: Record<string, unknown> = {}) => ({
    id: UUID,
    aspsp_name: "Revolut",
    aspsp_country: "hu",
    status: "active",
    authorized_at: "2026-04-18T08:00:00Z",
    consent_valid_until: "2026-10-15T08:00:00Z",
    last_sync_at: null,
    last_sync_ok: null,
    accounts: [],
    ...over,
  });
  const tz = "Europe/Budapest";

  it("a hibás sor kimarad, az ismeretlen státusz „error”, az ország nagybetűs", () => {
    const rows = parseConnections([row(), row({ id: null }), row({ consent_valid_until: "nem-dátum" }), row({ status: "weird" }), "x"]);
    expect(rows).toHaveLength(2);
    expect(rows[0].aspspCountry).toBe("HU");
    expect(rows[1].status).toBe("error");
    expect(parseConnections(null)).toEqual([]);
  });

  it("a session-azonosító és a hibaszöveg nem része a modellnek", () => {
    const [c] = parseConnections([row({ session_id: "SECRET-SESSION", last_error: "részlet" })]);
    expect(JSON.stringify(c)).not.toMatch(/SECRET-SESSION|részlet/);
  });

  it("állapot: aktív · hamarosan lejár (≤ 30 nap) · lejárt (múltbeli lejárat akkor is, ha a státusz még aktív) · visszavont · hiba", () => {
    const at = (iso: string) => new Date(iso);
    const [c] = parseConnections([row()]);
    expect(connectionHealth(c, tz, at("2026-06-01T10:00:00Z")).state).toBe("active");
    expect(connectionHealth(c, tz, at("2026-09-15T10:00:00Z"))).toMatchObject({ state: "soon", daysLeft: 30 });
    expect(connectionHealth(c, tz, at("2026-10-15T10:00:00Z"))).toMatchObject({ state: "soon", daysLeft: 0 });
    expect(connectionHealth(c, tz, at("2026-10-17T10:00:00Z"))).toMatchObject({ state: "expired", daysLeft: -2 });
    expect(connectionHealth(parseConnections([row({ status: "revoked" })])[0], tz, at("2026-06-01T10:00:00Z")).state).toBe("revoked");
    expect(connectionHealth(parseConnections([row({ status: "error" })])[0], tz, at("2026-06-01T10:00:00Z")).state).toBe("error");
  });

  it("az eltelt arány 0…1 közé szorított", () => {
    const [c] = parseConnections([row()]);
    expect(connectionHealth(c, tz, new Date("2026-01-01T00:00:00Z")).elapsed).toBe(0);
    expect(connectionHealth(c, tz, new Date("2027-01-01T00:00:00Z")).elapsed).toBe(1);
    const mid = connectionHealth(c, tz, new Date("2026-07-16T20:00:00Z")).elapsed;
    expect(mid).toBeGreaterThan(0.45);
    expect(mid).toBeLessThan(0.55);
  });
});

describe("callBankFunction: hibaleképezés", () => {
  const pick = (d: unknown) => (d ? { ok: true } : null);

  it("a törzs ismert `code`-ja előnyben van; az ismeretlen kódot nem vesszük át", async () => {
    const known = await callBankFunction(client({ error: httpError(400, { code: "state_expired" }) }), "f", {}, pick);
    expect(known).toEqual({ ok: false, code: "state_expired" });
    const unknown = await callBankFunction(client({ error: httpError(400, { code: "<script>" }) }), "f", {}, pick);
    expect(unknown).toEqual({ ok: false, code: "unknown" });
  });

  it("nem JSON törzs vagy kód nélküli válasz → a HTTP-státusz dönt", async () => {
    const cases: [number, string][] = [[401, "unauthenticated"], [403, "not_allowed"], [404, "not_found"], [429, "rate_limited"], [502, "upstream_failed"], [400, "unknown"]];
    for (const [status, code] of cases) {
      expect(await callBankFunction(client({ error: httpError(status) }), "f", {}, pick), String(status)).toEqual({ ok: false, code });
    }
  });

  it("hálózati hiba (nincs context) és kivétel → upstream_failed", async () => {
    expect(await callBankFunction(client({ error: new Error("relay") }), "f", {}, pick)).toEqual({ ok: false, code: "upstream_failed" });
    expect(await callBankFunction(client(new Error("boom")), "f", {}, pick)).toEqual({ ok: false, code: "upstream_failed" });
  });

  it("2xx, de `ok:false` a törzsben → a kód átjön; váratlan alak → upstream_failed; napló nem tartalmaz adatot", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await callBankFunction(client({ data: { ok: false, code: "not_allowed" } }), "f", {}, pick)).toEqual({ ok: false, code: "not_allowed" });
    expect(await callBankFunction(client({ data: null }), "f", {}, pick)).toEqual({ ok: false, code: "upstream_failed" });
    await callBankFunction(client({ error: httpError(500, { code: "upstream_failed", detail: "SECRET-PII" }) }), "f", { code: "SECRET-CODE" }, pick);
    expect(JSON.stringify(spy.mock.calls)).not.toMatch(/SECRET/);
    spy.mockRestore();
  });
});

describe("szolgáltatás-mag", () => {
  it("összekötés indítása: a kérés a szerződés szerinti alakú, a https URL átjön", async () => {
    const c = client({ data: { ok: true, url: "https://auth.example.com/start?x=1" } });
    expect(await startConnectionCore(c, { aspspName: "Revolut", aspspCountry: "HU" })).toEqual({ ok: true, data: { url: "https://auth.example.com/start?x=1" } });
    expect(c.calls).toEqual([{ name: "bank-connect-start", body: { aspsp_name: "Revolut", aspsp_country: "HU" } }]);
  });

  it("újra-hitelesítésnél a kapcsolat azonosítója is megy", async () => {
    const c = client({ data: { url: "https://auth.example.com/x" } });
    await startConnectionCore(c, { aspspName: "Revolut", aspspCountry: "HU", renewConnectionId: UUID });
    expect(c.calls[0]).toMatchObject({ body: { renew_connection_id: UUID } });
  });

  it("érvénytelen bemenet nem jut el a szerverig; nem https URL-t nem fogadunk el", async () => {
    const c = client({ data: { url: "https://auth.example.com/x" } });
    for (const bad of [{}, { aspspName: "", aspspCountry: "HU" }, { aspspName: "X", aspspCountry: "hu" }, { aspspName: "X", aspspCountry: "HU", renewConnectionId: "nem-uuid" }]) {
      expect(await startConnectionCore(c, bad)).toEqual({ ok: false, code: "unknown_bank" });
    }
    expect(c.calls).toHaveLength(0);
    for (const url of ["http://auth.example.com", "javascript:alert(1)", "data:text/html,x", "//evil.example", "nem url", 5, null, `https://a.example/${"x".repeat(3000)}`]) {
      expect(safeAuthUrl(url), String(url)).toBeNull();
    }
    expect(await startConnectionCore(client({ data: { url: "http://insecure.example" } }), { aspspName: "X", aspspCountry: "HU" })).toEqual({ ok: false, code: "upstream_failed" });
  });

  it("befejezés: code+state megy, a connection_id visszajön", async () => {
    const c = client({ data: { ok: true, connection_id: UUID } });
    expect(await finishConnectionCore(c, { code: "abcdefgh12", state: "abcdefgh34" })).toEqual({ ok: true, data: { connectionId: UUID } });
    expect(c.calls).toEqual([{ name: "bank-connect-finish", body: { code: "abcdefgh12", state: "abcdefgh34" } }]);
    expect(await finishConnectionCore(client({ error: httpError(400, { code: "state_invalid" }) }), { code: "abcdefgh12", state: "abcdefgh34" })).toEqual({ ok: false, code: "state_invalid" });
  });

  it("törlés: csak UUID, különben nem is hívunk", async () => {
    const c = client({ data: { ok: true } });
    expect(await disconnectCore(c, "nem-uuid")).toEqual({ ok: false, code: "not_found" });
    expect(c.calls).toHaveLength(0);
    expect(await disconnectCore(c, UUID)).toEqual({ ok: true, data: { done: true } });
    expect(c.calls).toEqual([{ name: "bank-disconnect", body: { connection_id: UUID } }]);
  });

  it("bank-lista: a hibás elem kimarad, a hozzáférés-hossz egész szám", async () => {
    const res = await listAspspsCore(client({ data: { ok: true, aspsps: [{ name: "Revolut", country: "HU", max_consent_days: 180 }, { name: 5 }, { name: "X", country: "hu" }, { name: "N26", country: "HU", max_consent_days: "180" }] } }));
    expect(res).toEqual({ ok: true, data: [{ name: "Revolut", country: "HU", maxConsentDays: 180 }, { name: "N26", country: "HU", maxConsentDays: null }] });
    expect(await listAspspsCore(client({ data: { ok: true } }))).toEqual({ ok: false, code: "upstream_failed" });
  });

  it("kézi frissítés válasza: csak ismert státusz", () => {
    expect(parseRefreshOutcome({ status: "too_soon", next_allowed_at: "2026-10-16T08:00:00Z" })).toEqual({ status: "too_soon", nextAllowedAt: "2026-10-16T08:00:00Z" });
    expect(parseRefreshOutcome({ status: "queued", next_allowed_at: "nem-dátum" })).toEqual({ status: "queued", nextAllowedAt: null });
    expect(parseRefreshOutcome({ status: "hack" })).toBeNull();
    expect(parseRefreshOutcome(null)).toBeNull();
  });
});
