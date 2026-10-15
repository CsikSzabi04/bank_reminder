// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A Supabase-klienst és a sütiket kicseréljük: a route logikáját (paraméter-szűrés, session, átirányítás) teszteljük
const state = vi.hoisted(() => ({
  sub: "user-1" as string | null,
  invoke: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("@/utils/supabase/server", () => ({
  createClient: () => ({
    auth: { getClaims: async () => ({ data: state.sub ? { claims: { sub: state.sub } } : null }) },
    functions: { invoke: state.invoke },
  }),
}));

import { GET } from "@/app/(app)/bank/callback/route";

const ORIGIN = "http://localhost:3000";
const CODE = "ef69c617-c894-46bf-9186-4f9e4d522884";
const STATE = "90b5c609-a1f5-4140-80e5-e4349b91b7cb";
const get = (query: string) => GET(new NextRequest(`${ORIGIN}/bank/callback${query}`));
const target = (res: Response) => new URL(res.headers.get("location") ?? "", ORIGIN);

beforeEach(() => {
  state.sub = "user-1";
  state.invoke.mockReset().mockResolvedValue({ data: { ok: true, connection_id: "0b3f8a55-62c1-4a6e-9c1b-1f2d3e4a5b6c" }, error: null });
});

describe("GET /bank/callback", () => {
  it("siker: a code+state a szerverre megy, a felhasználó a /bank?…result=connected oldalra érkezik — az URL-ben már nincs code/state", async () => {
    const res = await get(`?code=${CODE}&state=${STATE}`);
    expect(state.invoke).toHaveBeenCalledWith("bank-connect-finish", { body: { code: CODE, state: STATE } });
    expect(res.status).toBe(307);
    const to = target(res);
    expect(to.pathname).toBe("/bank");
    expect(to.searchParams.get("section")).toBe("overview");
    expect(to.searchParams.get("result")).toBe("connected");
    expect(to.search).not.toContain(CODE);
    expect(to.search).not.toContain(STATE);
  });

  it("a válasz nem gyorsítótárazható és nem küld Referer-t (a code ne szivárogjon)", async () => {
    const res = await get(`?code=${CODE}&state=${STATE}`);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("újrahasznált / ismeretlen state: barátságos hibakód, a hibaüzenet nem tükröződik vissza", async () => {
    state.invoke.mockResolvedValue({
      data: null,
      error: { context: { status: 400, json: async () => ({ code: "state_invalid", detail: "<script>x</script>" }) } },
    });
    const to = target(await get(`?code=${CODE}&state=${STATE}`));
    expect(to.searchParams.get("result")).toBe("error");
    expect(to.searchParams.get("reason")).toBe("state_invalid");
    expect(to.search).not.toContain("script");
  });

  it("lejárt state → state_expired", async () => {
    state.invoke.mockResolvedValue({ data: null, error: { context: { status: 400, json: async () => ({ code: "state_expired" }) } } });
    expect(target(await get(`?code=${CODE}&state=${STATE}`)).searchParams.get("reason")).toBe("state_expired");
  });

  it("a bank hibája (megtagadás, hiba): nem hívjuk a szervert", async () => {
    expect(target(await get(`?state=${STATE}&error=access_denied`)).searchParams.get("reason")).toBe("bank_denied");
    expect(target(await get(`?state=${STATE}&error=server_error`)).searchParams.get("reason")).toBe("bank_error");
    expect(state.invoke).not.toHaveBeenCalled();
  });

  it("hiányzó vagy furcsa paraméter: nem hívjuk a szervert", async () => {
    for (const q of ["", `?code=${CODE}`, `?state=${STATE}`, "?code=<x>&state=<y>"]) {
      expect(target(await get(q)).searchParams.get("reason"), q).toBe("invalid_callback");
    }
    expect(state.invoke).not.toHaveBeenCalled();
  });

  it("session nélkül (a proxy mélységi védelme) nem hívjuk a szervert", async () => {
    state.sub = null;
    expect(target(await get(`?code=${CODE}&state=${STATE}`)).searchParams.get("reason")).toBe("unauthenticated");
    expect(state.invoke).not.toHaveBeenCalled();
  });

  it("a szerver elérhetetlen → upstream_failed (nem 500)", async () => {
    state.invoke.mockRejectedValue(new Error("network"));
    const res = await get(`?code=${CODE}&state=${STATE}`);
    expect(res.status).toBe(307);
    expect(target(res).searchParams.get("reason")).toBe("upstream_failed");
  });

  it("a napló nem tartalmazza a code-ot és a state-et", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    state.invoke.mockResolvedValue({ data: null, error: { context: { status: 502, json: async () => ({}) } } });
    await get(`?code=${CODE}&state=${STATE}`);
    expect(JSON.stringify(spy.mock.calls)).not.toMatch(new RegExp(`${CODE}|${STATE}`));
    spy.mockRestore();
  });
});
