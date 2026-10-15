// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bankMatchPatch, checkBankMatch } from "@/lib/bank/match";
import { reminderSchema, readReminderForm } from "@/lib/schemas/reminder";
import { goalSchema } from "@/lib/schemas/savings";

describe("checkBankMatch — Bank-egyeztetés kulcsszó (A-48)", () => {
  it("üres → nincs kulcsszó (null); a kitöltött a DB-vel azonos, normalizált alakban megy", () => {
    expect(checkBankMatch("")).toEqual({ ok: true, value: null });
    expect(checkBankMatch("   ")).toEqual({ ok: true, value: null });
    expect(checkBankMatch(null)).toEqual({ ok: true, value: null });
    expect(checkBankMatch("Anthropic")).toEqual({ ok: true, value: "anthropic" });
    expect(checkBankMatch("  Árvíztűrő  Tükör ")).toEqual({ ok: true, value: "arvizturo tukor" });
  });

  it("a normalizált alak 2–60 karakter: rövid/hosszú → hibakód", () => {
    expect(checkBankMatch("a")).toEqual({ ok: false, reason: "bankMatchShort" });
    expect(checkBankMatch("!!")).toEqual({ ok: false, reason: "bankMatchShort" });
    expect(checkBankMatch("ab")).toEqual({ ok: true, value: "ab" });
    expect(checkBankMatch("x".repeat(60))).toMatchObject({ ok: true });
    expect(checkBankMatch("x".repeat(61))).toEqual({ ok: false, reason: "bankMatchLong" });
  });
});

describe("bankMatchPatch — csak akkor írunk, ha van mit (az oszlop a db:push előtt még nincs)", () => {
  it("kitöltött érték mindig megy; törölt, de korábban beállított → null; üres és korábban sem volt → az oszlopot nem érintjük", () => {
    expect(bankMatchPatch("anthropic", false)).toEqual({ bank_match: "anthropic" });
    expect(bankMatchPatch("anthropic", true)).toEqual({ bank_match: "anthropic" });
    expect(bankMatchPatch(null, true)).toEqual({ bank_match: null });
    expect(bankMatchPatch(null, false)).toEqual({});
    expect("bank_match" in bankMatchPatch(null, false)).toBe(false);
  });
});

const baseReminder = {
  name: "Claude",
  amount: "7000",
  currency: "HUF",
  categoryId: "",
  serviceSlug: "",
  recurrence: "month",
  recurEvery: "1",
  startDate: "2026-12-01",
  remindTime: "09:00",
};
const parse = (extra: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ ...baseReminder, ...extra })) fd.append(k, v);
  fd.append("offset", "1");
  return reminderSchema.safeParse(readReminderForm(fd));
};

describe("reminderSchema.bankMatch", () => {
  it("üres és érvényes kulcsszó átmegy; a rövid hibát ad a mezőn", () => {
    expect(parse({}).success).toBe(true);
    expect(parse({ bankMatch: "anthropic" }).success).toBe(true);
    const bad = parse({ bankMatch: "a" });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(bad.error.issues.some((i) => i.path[0] === "bankMatch" && i.message === "bankMatchShort")).toBe(true);
  });

  it("a link (url) továbbra is csak http/https", () => {
    expect(parse({ url: "https://claude.ai" }).success).toBe(true);
    expect(parse({ url: "javascript:alert(1)" }).success).toBe(false);
    expect(parse({ url: "ftp://example.com" }).success).toBe(false);
  });
});

describe("goalSchema.bankMatch", () => {
  const goal = { name: "Nyaralás", target: "100000", icon: "plane", colorSlot: "1" };
  it("üres és érvényes átmegy; a rövid/hosszú hibát ad a mezőn", () => {
    expect(goalSchema.safeParse(goal).success).toBe(true);
    expect(goalSchema.safeParse({ ...goal, bankMatch: "nyaralas" }).success).toBe(true);
    for (const [bankMatch, message] of [["x", "bankMatchShort"], ["y".repeat(70), "bankMatchLong"]] as const) {
      const r = goalSchema.safeParse({ ...goal, bankMatch });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues.some((i) => i.path[0] === "bankMatch" && i.message === message)).toBe(true);
    }
  });
});

// ───────── a mentés: csak akkor kerül az oszlop a payloadba, ha van mit írni ─────────
const state = vi.hoisted(() => ({ sub: "user-1" as string | null, insert: vi.fn(), update: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }) }));
vi.mock("@/utils/supabase/server", () => {
  const done = { select: () => ({ single: async () => ({ data: { id: "new-id" }, error: null }) }) };
  return {
    createClient: () => ({
      auth: { getClaims: async () => ({ data: state.sub ? { claims: { sub: state.sub } } : null }) },
      rpc: async () => ({ data: null, error: null }),
      from: () => ({
        select: () => ({ eq: () => ({ single: async () => ({ data: { timezone: "Europe/Budapest", base_currency: "HUF" } }) }) }),
        insert: (row: unknown) => (state.insert(row), done),
        update: (row: unknown) => (state.update(row), { eq: () => done }),
      }),
    }),
  };
});

import { saveReminder } from "@/lib/reminders/form-actions";
import { saveGoal } from "@/lib/savings/actions";

const ID = "0b3f8a55-62c1-4a6e-9c1b-1f2d3e4a5b6c";
const form = (extra: Record<string, string>, base: Record<string, string> = baseReminder) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ ...base, ...extra })) fd.append(k, v);
  fd.append("offset", "1");
  return fd;
};

describe("saveReminder — a bank_match oszlop csak szükség esetén kerül a payloadba", () => {
  beforeEach(() => {
    state.insert.mockReset();
    state.update.mockReset();
  });
  const run = async (reminderId: string | null, extra: Record<string, string>) => {
    await saveReminder(reminderId, null, form({ startDate: "2099-12-01", ...extra })).catch(() => undefined);
    return (reminderId ? state.update : state.insert).mock.calls[0]?.[0] as Record<string, unknown>;
  };

  it("új emlékeztető kulcsszó nélkül: az oszlop nincs a payloadban (az oszlop nélküli DB-n is menthető)", async () => {
    expect(await run(null, {})).not.toHaveProperty("bank_match");
  });

  it("kulcsszóval: normalizált érték megy", async () => {
    expect(await run(null, { bankMatch: " Anthropic " })).toMatchObject({ bank_match: "anthropic" });
  });

  it("szerkesztésnél a korábban beállított kulcsszó törlése null-t ír; ha korábban sem volt, nem érinti az oszlopot", async () => {
    expect(await run(ID, { bankMatch: "", bankMatchWas: "1" })).toMatchObject({ bank_match: null });
    state.update.mockReset();
    expect(await run(ID, { bankMatch: "", bankMatchWas: "0" })).not.toHaveProperty("bank_match");
  });

  it("érvénytelen kulcsszónál nincs írás", async () => {
    const result = await saveReminder(ID, null, form({ startDate: "2099-12-01", bankMatch: "a" }));
    expect(result).toMatchObject({ ok: false, code: "validation" });
    expect(state.update).not.toHaveBeenCalled();
  });
});

describe("saveGoal — a bank_match oszlop csak szükség esetén kerül a payloadba", () => {
  beforeEach(() => {
    state.insert.mockReset();
    state.update.mockReset();
  });
  const goalForm = { name: "Nyaralás", target: "100000", targetDate: "", icon: "plane", colorSlot: "1" };
  const run = async (extra: Record<string, string>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries({ ...goalForm, ...extra })) fd.append(k, v);
    await saveGoal(null, null, fd).catch(() => undefined);
    return state.insert.mock.calls[0]?.[0] as Record<string, unknown>;
  };

  it("kulcsszó nélkül nincs oszlop; kulcsszóval a normalizált érték megy", async () => {
    expect(await run({})).not.toHaveProperty("bank_match");
    state.insert.mockReset();
    expect(await run({ bankMatch: "Nyaralás" })).toMatchObject({ bank_match: "nyaralas" });
  });
});

describe("saveGoal — a régi űrlap (bankMatch mező nélkül) nem hibázik", () => {
  it("a hiányzó mező üresként kezelt, a mentés megtörténik, az oszlop nélkül", async () => {
    state.insert.mockReset();
    const fd = new FormData();
    for (const [k, v] of Object.entries({ name: "Nyaralás", target: "100000", targetDate: "", icon: "plane", colorSlot: "1" })) fd.append(k, v);
    await saveGoal(null, null, fd).catch(() => undefined);
    expect(state.insert).toHaveBeenCalledTimes(1);
    expect(state.insert.mock.calls[0][0]).not.toHaveProperty("bank_match");
  });
});
