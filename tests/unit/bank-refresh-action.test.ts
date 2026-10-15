// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// A Supabase-klienst és a jogosultság-ellenőrzést kicseréljük: a „Frissítés most" művelet hibaleképezését teszteljük
const state = vi.hoisted(() => ({
  sub: "user-1" as string | null,
  allowed: true,
  rpc: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/bank/queries", () => ({ getBankAccess: async () => ({ syncAllowed: state.allowed }) }));
vi.mock("@/utils/supabase/server", () => ({
  createClient: () => ({
    auth: { getClaims: async () => ({ data: state.sub ? { claims: { sub: state.sub } } : null }) },
    rpc: state.rpc,
  }),
}));

import { refreshBankNow } from "@/lib/bank/actions";

const ID = "0b3f8a55-62c1-4a6e-9c1b-1f2d3e4a5b6c";

beforeEach(() => {
  state.sub = "user-1";
  state.allowed = true;
  state.rpc.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("refreshBankNow", () => {
  it("a szerver válasza (sorban kért) átjön, az RPC a kapcsolat-azonosítóval hívódik", async () => {
    state.rpc.mockResolvedValue({ data: { status: "queued" }, error: null });
    expect(await refreshBankNow(ID)).toEqual({ ok: true, data: { status: "queued", nextAllowedAt: null } });
    expect(state.rpc).toHaveBeenCalledWith("request_bank_sync", { p_connection_id: ID });
  });

  it("a függvény még nincs telepítve (A-48 előtt) → „unavailable”, nem „a bank nem válaszol”", async () => {
    for (const code of ["PGRST202", "42883"]) {
      state.rpc.mockResolvedValue({ data: null, error: { code } });
      expect(await refreshBankNow(ID), code).toMatchObject({ ok: false, reason: "unavailable" });
    }
  });

  it("idegen/ismeretlen kapcsolat (P0002) → not_found; bármi más → upstream_failed", async () => {
    state.rpc.mockResolvedValue({ data: null, error: { code: "P0002" } });
    expect(await refreshBankNow(ID)).toMatchObject({ ok: false, code: "not_found", reason: "not_found" });
    state.rpc.mockResolvedValue({ data: null, error: { code: "XX000" } });
    expect(await refreshBankNow(ID)).toMatchObject({ ok: false, code: "upstream_failed", reason: "upstream_failed" });
  });

  it("váratlan válasz-alak → upstream_failed", async () => {
    state.rpc.mockResolvedValue({ data: { status: "hack" }, error: null });
    expect(await refreshBankNow(ID)).toMatchObject({ ok: false, reason: "upstream_failed" });
  });

  it("érvénytelen azonosító, jogosultság nélkül és kijelentkezve nincs RPC-hívás", async () => {
    expect(await refreshBankNow("nem-uuid")).toMatchObject({ ok: false, reason: "not_found" });
    state.allowed = false;
    expect(await refreshBankNow(ID)).toMatchObject({ ok: false, reason: "not_allowed" });
    state.allowed = true;
    state.sub = null;
    expect(await refreshBankNow(ID)).toMatchObject({ ok: false, reason: "unauthenticated" });
    expect(state.rpc).not.toHaveBeenCalled();
  });
});
