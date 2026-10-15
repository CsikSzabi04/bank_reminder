import { describe, expect, it } from "vitest";
import {
  activeTokens,
  curlExample,
  ingestStatus,
  isValidPackageName,
  JSON_TEMPLATE,
  normalizeApps,
  parseIngestEvents,
  parseIngestTokens,
  recentApps,
  webhookUrl,
  type IngestEvent,
} from "@/lib/bank/ingest";
import { createTokenCore, regenerateTokenCore, revokeTokenCore, setAppsCore, type IngestRpcClient } from "@/lib/bank/ingest-service";

const UUID = "0b3f8a55-62c1-4a6e-9c1b-1f2d3e4a5b6c";
const RAW = "tk_" + "a".repeat(40);

describe("csomagnév és engedélyezett appok", () => {
  it("érvényes Android-csomagnevek", () => {
    for (const ok of ["hu.otpbank.mobile", "com.revolut.revolut", "a.b", "hu.bank_app.v2"]) expect(isValidPackageName(ok), ok).toBe(true);
  });

  it("érvénytelen alakok: pont nélküli, számmal kezdődő szegmens, szóköz, speciális karakter, túl hosszú", () => {
    for (const bad of ["bank", "1.bank", "hu..bank", ".hu.bank", "hu.bank.", "hu bank.app", "hu.bank/app", "hu.bank;drop", "<script>", `a.${"b".repeat(200)}`, ""]) {
      expect(isValidPackageName(bad), bad).toBe(false);
    }
  });

  it("normalizeApps: szóköz levágva, egyedi, üres kimarad; az első érvénytelen elem hibát ad", () => {
    expect(normalizeApps(["  hu.a.b ", "hu.a.b", "", "com.x.y"])).toEqual({ ok: true, apps: ["hu.a.b", "com.x.y"] });
    expect(normalizeApps(["hu.a.b", "nem csomag"])).toEqual({ ok: false, reason: "invalid" });
    expect(normalizeApps([])).toEqual({ ok: true, apps: [] });
  });

  it("legfeljebb 20 app és 2000 bájt (egyezik az adatbázis CHECK-jével)", () => {
    const many = Array.from({ length: 21 }, (_, i) => `hu.app.n${i}`);
    expect(normalizeApps(many)).toEqual({ ok: false, reason: "tooMany" });
    expect(normalizeApps(many.slice(0, 20))).toMatchObject({ ok: true });
    // 20 elem, de együtt > 2000 bájt: elemenként ≤ 200 karakter a csomagnév-korlát, 12 × 190 + elválasztók > 2000
    const long = Array.from({ length: 12 }, (_, i) => `hu.${"x".repeat(180)}.n${i}`);
    expect(normalizeApps(long)).toEqual({ ok: false, reason: "tooLong" });
  });
});

describe("olvasók (tűrő parserek)", () => {
  it("tokenek: hibás sor kimarad; az érvénytelen csomagnév az allowlistből kiszűrődik; a nyers/hash mező sosem része a modellnek", () => {
    const tokens = parseIngestTokens([
      { id: UUID, prefix: "tk_abc", label: "Telefon", allowed_apps: ["hu.a.b", "nem csomag", 5], last_used_at: "2026-10-10T10:00:00Z", revoked_at: null, created_at: "2026-10-01T10:00:00Z", token_hash: "SECRET-HASH" },
      { id: UUID, prefix: "", created_at: "2026-10-01T10:00:00Z" },
      { id: UUID, prefix: "tk_x", created_at: "nem-dátum" },
      "x",
    ]);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({ prefix: "tk_abc", label: "Telefon", allowedApps: ["hu.a.b"], revokedAt: null });
    expect(JSON.stringify(tokens)).not.toContain("SECRET-HASH");
    expect(parseIngestTokens(null)).toEqual([]);
  });

  it("aktív tokenek: a visszavont kimarad", () => {
    const tokens = parseIngestTokens([
      { id: "a", prefix: "tk_a", created_at: "2026-10-01T10:00:00Z", revoked_at: null },
      { id: "b", prefix: "tk_b", created_at: "2026-10-01T10:00:00Z", revoked_at: "2026-10-02T10:00:00Z" },
    ]);
    expect(activeTokens(tokens).map((t) => t.id)).toEqual(["a"]);
  });

  it("események: csak ismert kimenet és érvényes idő; nyers szöveg nincs a modellben", () => {
    const events = parseIngestEvents([
      { id: 1, app: "hu.a.b", outcome: "recorded", at: "2026-10-10T10:00:00Z", raw_text: "TITOK-SZÖVEG" },
      { id: 2, app: null, outcome: "hack", at: "2026-10-10T10:00:00Z" },
      { id: "3", app: "x", outcome: "ignored", at: "2026-10-10T10:00:00Z" },
      { id: 4, app: "x", outcome: "ignored", at: "nem-dátum" },
    ]);
    expect(events).toEqual([{ id: 1, app: "hu.a.b", outcome: "recorded", at: "2026-10-10T10:00:00Z" }]);
    expect(JSON.stringify(events)).not.toContain("TITOK");
  });
});

describe("recentApps — „Legutóbb érkezett appok”", () => {
  const ev = (id: number, app: string | null, at: string): IngestEvent => ({ id, app, outcome: "rejected", at });
  it("a legújabb elöl, egyedi, az engedélyezettek és az érvénytelenek nélkül, korlátozva", () => {
    const events = [ev(1, "hu.old.app", "2026-10-01T10:00:00Z"), ev(2, "hu.new.app", "2026-10-05T10:00:00Z"), ev(3, "hu.new.app", "2026-10-04T10:00:00Z"), ev(4, "hu.allowed.app", "2026-10-06T10:00:00Z"), ev(5, "nem csomag", "2026-10-07T10:00:00Z"), ev(6, null, "2026-10-08T10:00:00Z")];
    expect(recentApps(events, ["hu.allowed.app"])).toEqual(["hu.new.app", "hu.old.app"]);
    expect(recentApps(events, [], 1)).toEqual(["hu.allowed.app"]);
  });
});

describe("ingestStatus — „Utolsó esemény”", () => {
  const ev = (at: string): IngestEvent => ({ id: 1, app: "hu.a.b", outcome: "recorded", at });
  const now = new Date("2026-10-15T12:00:00Z");
  it("nincs esemény → never; 24 órán belül → recent; azon túl → stale (a legfrissebb számít)", () => {
    expect(ingestStatus([], now)).toEqual({ kind: "never" });
    expect(ingestStatus([ev("2026-10-15T11:58:00Z")], now)).toEqual({ kind: "recent", at: "2026-10-15T11:58:00Z" });
    expect(ingestStatus([ev("2026-10-14T12:00:00Z")], now)).toEqual({ kind: "recent", at: "2026-10-14T12:00:00Z" }); // pontosan 24 óra: még friss
    expect(ingestStatus([ev("2026-10-14T11:59:59Z")], now)).toEqual({ kind: "stale", at: "2026-10-14T11:59:59Z" });
    expect(ingestStatus([ev("2026-09-01T00:00:00Z"), ev("2026-10-15T11:00:00Z")], now).kind).toBe("recent");
  });
});

describe("webhook-cím és minták", () => {
  it("a cím a projekt-URL-ből épül; csak https", () => {
    expect(webhookUrl("https://abc.supabase.co")).toBe("https://abc.supabase.co/functions/v1/ingest-notification");
    expect(webhookUrl("https://abc.supabase.co/rest/v1/")).toBe("https://abc.supabase.co/functions/v1/ingest-notification");
    for (const bad of [undefined, "", "http://abc.supabase.co", "nem url", "javascript:alert(1)"]) expect(webhookUrl(bad), String(bad)).toBeNull();
  });

  it("a JSON-sablon érvényes JSON-szerkezet a három mezővel; a curl-példa nem tartalmaz valódi tokent", () => {
    const body = JSON.parse(JSON_TEMPLATE) as Record<string, string>;
    expect(Object.keys(body).sort()).toEqual(["app", "text", "title"]);
    const curl = curlExample("https://abc.supabase.co/functions/v1/ingest-notification");
    expect(curl).toContain("x-ingest-token: <A_TOKENED>");
    expect(curl).toContain("https://abc.supabase.co/functions/v1/ingest-notification");
  });
});

// ───────── szolgáltatás-mag (A-44 RPC-k) ─────────
type Call = { fn: string; args?: Record<string, unknown> };
function rpcClient(handler: (call: Call) => { data?: unknown; error?: { code?: string } | null }) {
  const calls: Call[] = [];
  const client: IngestRpcClient = {
    rpc: async (fn, args) => {
      const call = { fn, args };
      calls.push(call);
      const r = handler(call);
      return { data: r.data ?? null, error: r.error ?? null };
    },
  };
  return { client, calls };
}
const created = { id: UUID, token: RAW, prefix: "tk_aaa" };

describe("createTokenCore", () => {
  it("az argumentumok a szerződés szerint mennek; a nyers token a válaszból jön", async () => {
    const { client, calls } = rpcClient(() => ({ data: created }));
    expect(await createTokenCore(client, { label: "  Telefon ", apps: ["hu.a.b"] })).toEqual({ ok: true, data: created });
    expect(calls).toEqual([{ fn: "create_ingest_token", args: { p_label: "Telefon", p_allowed_apps: ["hu.a.b"] } }]);
  });

  it("üres címke null-ként megy; üres app-lista megengedett (semmi nem engedett)", async () => {
    const { client, calls } = rpcClient(() => ({ data: created }));
    await createTokenCore(client, { label: "   ", apps: [] });
    expect(calls[0].args).toEqual({ p_label: null, p_allowed_apps: [] });
  });

  it("érvénytelen bemenet nem jut el a szerverig", async () => {
    const { client, calls } = rpcClient(() => ({ data: created }));
    expect(await createTokenCore(client, { label: "x".repeat(41), apps: [] })).toEqual({ ok: false, code: "label_too_long" });
    expect(await createTokenCore(client, { label: "", apps: ["nem csomag"] })).toEqual({ ok: false, code: "invalid_apps" });
    expect(calls).toHaveLength(0);
  });

  it("hibakód-leképezés: PGRST202/42883 → unavailable, 53400 → limit_reached, más → failed", async () => {
    const run = async (code?: string) => createTokenCore(rpcClient(() => ({ error: { code } })).client, { label: "", apps: [] });
    expect(await run("PGRST202")).toEqual({ ok: false, code: "unavailable" });
    expect(await run("42883")).toEqual({ ok: false, code: "unavailable" });
    expect(await run("53400")).toEqual({ ok: false, code: "limit_reached" });
    expect(await run("XX000")).toEqual({ ok: false, code: "failed" });
  });

  it("hibás szerver-válasz (rövid/hiányzó token) nem kerül megmutatásra", async () => {
    for (const data of [null, {}, { id: UUID, token: "rövid", prefix: "tk" }, { id: UUID, token: RAW }, { token: RAW, prefix: "x" }]) {
      expect(await createTokenCore(rpcClient(() => ({ data })).client, { label: "", apps: [] }), JSON.stringify(data)).toEqual({ ok: false, code: "failed" });
    }
  });
});

describe("revoke / apps", () => {
  it("visszavonás: p_token; P0002 → not_found", async () => {
    const { client, calls } = rpcClient(() => ({}));
    expect(await revokeTokenCore(client, UUID)).toEqual({ ok: true, data: null });
    expect(calls).toEqual([{ fn: "revoke_ingest_token", args: { p_token: UUID } }]);
    expect(await revokeTokenCore(rpcClient(() => ({ error: { code: "P0002" } })).client, UUID)).toEqual({ ok: false, code: "not_found" });
  });

  it("engedélyezett appok mentése: tisztított lista megy, a szerver nem látja az érvénytelent", async () => {
    const { client, calls } = rpcClient(() => ({}));
    expect(await setAppsCore(client, UUID, [" hu.a.b ", "hu.a.b", "com.x.y"])).toEqual({ ok: true, data: { apps: ["hu.a.b", "com.x.y"] } });
    expect(calls).toEqual([{ fn: "set_ingest_apps", args: { p_token: UUID, p_apps: ["hu.a.b", "com.x.y"] } }]);
    expect(await setAppsCore(client, UUID, ["nem csomag"])).toEqual({ ok: false, code: "invalid_apps" });
    expect(calls).toHaveLength(1);
  });
});

describe("regenerateTokenCore — előbb az új, utána a régi visszavonása", () => {
  const old = { id: "old-token-id", label: "Telefon", apps: ["hu.a.b"] };

  it("sorrend: create_ingest_token, majd revoke_ingest_token; az új token ugyanazzal a címkével és appokkal", async () => {
    const { client, calls } = rpcClient((c) => (c.fn === "create_ingest_token" ? { data: created } : {}));
    expect(await regenerateTokenCore(client, old)).toEqual({ ok: true, data: { ...created, oldRevoked: true } });
    expect(calls.map((c) => c.fn)).toEqual(["create_ingest_token", "revoke_ingest_token"]);
    expect(calls[0].args).toEqual({ p_label: "Telefon", p_allowed_apps: ["hu.a.b"] });
    expect(calls[1].args).toEqual({ p_token: "old-token-id" });
  });

  it("ha az új token létrehozása bukik, a régit NEM vonjuk vissza (nem maradunk token nélkül)", async () => {
    const { client, calls } = rpcClient(() => ({ error: { code: "XX000" } }));
    expect(await regenerateTokenCore(client, old)).toEqual({ ok: false, code: "failed" });
    expect(calls.map((c) => c.fn)).toEqual(["create_ingest_token"]);
  });

  it("ha a visszavonás bukik, az új token mégis megvan, és a felület jelzi, hogy a régi még él", async () => {
    const { client } = rpcClient((c) => (c.fn === "create_ingest_token" ? { data: created } : { error: { code: "XX000" } }));
    expect(await regenerateTokenCore(client, old)).toEqual({ ok: true, data: { ...created, oldRevoked: false } });
  });
});
