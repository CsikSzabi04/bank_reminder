// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// A Supabase-klienst kicseréljük: az akciók jogosultság-, bemenet- és szerver-oldali adatforrás-szabályait teszteljük
const state = vi.hoisted(() => ({
  sub: "user-1" as string | null,
  rpc: vi.fn(),
  tokenRow: null as { id: string; label: string | null; allowed_apps: string[] } | null,
  tokenFilters: [] as string[],
  events: [] as unknown[],
  eventsFrom: "",
  tx: null as { merchant: string | null; amount: number; currency: string } | null,
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

function chain(result: () => unknown, onGte?: (v: string) => void, onFilter?: (f: string) => void) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit"]) q[m] = () => q;
  q.is = (col: string) => (onFilter?.(`is:${col}`), q);
  q.gte = (_c: string, v: string) => (onGte?.(v), q);
  q.maybeSingle = async () => ({ data: result(), error: null });
  q.then = (resolve: (v: unknown) => unknown) => resolve({ data: result(), error: null });
  return q;
}
vi.mock("@/utils/supabase/server", () => ({
  createClient: () => ({
    auth: { getClaims: async () => ({ data: state.sub ? { claims: { sub: state.sub } } : null }) },
    rpc: state.rpc,
    from: (table: string) => {
      if (table === "ingest_tokens") return chain(() => state.tokenRow, undefined, (f) => state.tokenFilters.push(f));
      if (table === "ingest_events") return chain(() => state.events, (v) => (state.eventsFrom = v));
      return chain(() => state.tx);
    },
  }),
}));

import { createIngestToken, pollIngestEvents, regenerateIngestToken, revokeIngestToken, saveIngestApps } from "@/lib/bank/ingest-actions";

const ID = "0b3f8a55-62c1-4a6e-9c1b-1f2d3e4a5b6c";
const RAW = `tk_${"y".repeat(40)}`;

beforeEach(() => {
  state.sub = "user-1";
  state.rpc.mockReset();
  state.tokenRow = null;
  state.tokenFilters = [];
  state.events = [];
  state.eventsFrom = "";
  state.tx = null;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("bejelentkezés és bemenet-ellenőrzés", () => {
  it("kijelentkezve egyik művelet sem hív RPC-t", async () => {
    state.sub = null;
    expect(await createIngestToken({ label: "", apps: [] })).toMatchObject({ ok: false, code: "unauthenticated" });
    expect(await revokeIngestToken(ID)).toMatchObject({ ok: false, code: "unauthenticated" });
    expect(await regenerateIngestToken(ID)).toMatchObject({ ok: false, code: "unauthenticated" });
    expect(await saveIngestApps({ id: ID, apps: [] })).toMatchObject({ ok: false, code: "unauthenticated" });
    expect(await pollIngestEvents(new Date().toISOString())).toMatchObject({ ok: false, code: "unauthenticated" });
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("érvénytelen azonosító / túl nagy bemenet → validation, nincs RPC", async () => {
    expect(await revokeIngestToken("nem-uuid")).toMatchObject({ ok: false, code: "validation" });
    expect(await regenerateIngestToken("nem-uuid")).toMatchObject({ ok: false, code: "validation" });
    expect(await saveIngestApps({ id: "nem-uuid", apps: [] })).toMatchObject({ ok: false, code: "validation" });
    expect(await saveIngestApps({ id: ID, apps: Array.from({ length: 101 }, () => "hu.a.b") })).toMatchObject({ ok: false, code: "validation" });
    expect(await createIngestToken({ label: "x".repeat(201), apps: [] })).toMatchObject({ ok: false, code: "validation" });
    expect(state.rpc).not.toHaveBeenCalled();
  });
});

describe("a nyers token csak a létrehozás válaszában utazik", () => {
  it("létrehozás: a token a válaszban van; a szerver-hiba (nincs telepítve) érthető okot ad", async () => {
    state.rpc.mockResolvedValue({ data: { id: ID, token: RAW, prefix: "tk_yyy" }, error: null });
    expect(await createIngestToken({ label: "Telefon", apps: [] })).toEqual({ ok: true, data: { id: ID, token: RAW, prefix: "tk_yyy" } });
    state.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    expect(await createIngestToken({ label: "", apps: [] })).toMatchObject({ ok: false, reason: "unavailable" });
  });

  it("a naplóba nem kerül token (hiba esetén sem)", async () => {
    state.rpc.mockResolvedValue({ data: { id: ID, token: RAW, prefix: "tk_yyy" }, error: null });
    await createIngestToken({ label: "", apps: [] });
    expect(JSON.stringify((console.error as unknown as { mock: { calls: unknown[] } }).mock.calls)).not.toContain(RAW);
  });
});

describe("regenerateIngestToken — a címkét és az appokat a SZERVER olvassa ki", () => {
  it("a kliens nem küldhet címkét/appot: a tárolt tokenből készül az új, csak az aktív (nem visszavont) tokenből", async () => {
    state.tokenRow = { id: ID, label: "Telefon", allowed_apps: ["hu.a.b"] };
    state.rpc.mockImplementation(async (fn: string) => (fn === "create_ingest_token" ? { data: { id: "new", token: RAW, prefix: "tk_new" }, error: null } : { data: null, error: null }));
    expect(await regenerateIngestToken(ID)).toEqual({ ok: true, data: { id: "new", token: RAW, prefix: "tk_new", oldRevoked: true } });
    expect(state.rpc.mock.calls[0]).toEqual(["create_ingest_token", { p_label: "Telefon", p_allowed_apps: ["hu.a.b"] }]);
    expect(state.rpc.mock.calls[1]).toEqual(["revoke_ingest_token", { p_token: ID }]);
    expect(state.tokenFilters).toContain("is:revoked_at");
  });

  it("nem létező / idegen / már visszavont token → not_found, nincs RPC", async () => {
    state.tokenRow = null;
    expect(await regenerateIngestToken(ID)).toMatchObject({ ok: false, code: "not_found", reason: "not_found" });
    expect(state.rpc).not.toHaveBeenCalled();
  });
});

describe("pollIngestEvents", () => {
  it("érvénytelen időpont → validation; a lekérdezés legfeljebb 10 percre nyúlik vissza", async () => {
    expect(await pollIngestEvents("nem-dátum")).toMatchObject({ ok: false, code: "validation" });
    await pollIngestEvents("2020-01-01T00:00:00Z");
    expect(Date.now() - Date.parse(state.eventsFrom)).toBeLessThanOrEqual(10 * 60_000 + 2000);
    expect(Date.now() - Date.parse(state.eventsFrom)).toBeGreaterThanOrEqual(10 * 60_000 - 2000);
  });

  it("felvétel esetén a kiolvasott tétel is visszajön; más kimenetnél nincs tétel-lekérdezés eredménye", async () => {
    state.events = [{ id: 1, app: "hu.a.b", outcome: "recorded", at: new Date().toISOString() }];
    state.tx = { merchant: "Tesco", amount: 4500, currency: "HUF" };
    expect(await pollIngestEvents(new Date().toISOString())).toEqual({
      ok: true,
      data: { events: [expect.objectContaining({ outcome: "recorded" })], parsed: { merchant: "Tesco", amount: 4500, currency: "HUF" } },
    });
    state.events = [{ id: 2, app: "hu.a.b", outcome: "ignored", at: new Date().toISOString() }];
    expect(await pollIngestEvents(new Date().toISOString())).toMatchObject({ ok: true, data: { parsed: null } });
    state.events = [];
    expect(await pollIngestEvents(new Date().toISOString())).toMatchObject({ ok: true, data: { events: [], parsed: null } });
  });
});
