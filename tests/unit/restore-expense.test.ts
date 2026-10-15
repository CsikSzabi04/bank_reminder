// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

// A Supabase-klienst kicseréljük: a restoreExpense validációját és az insert tartalmát teszteljük
const state = vi.hoisted(() => ({
  sub: "user-1" as string | null,
  insert: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/utils/supabase/server", () => ({
  createClient: () => ({
    auth: { getClaims: async () => ({ data: state.sub ? { claims: { sub: state.sub } } : null }) },
    from: () => ({
      insert: (row: unknown) => {
        state.insert(row);
        return { select: () => ({ single: async () => ({ data: { id: "new-id" }, error: null }) }) };
      },
    }),
  }),
}));

import { restoreExpense, type RestoreExpenseInput } from "@/lib/budgets/actions";

const CAT = "0b3f8a55-62c1-4a6e-9c1b-1f2d3e4a5b6c";
const ok: RestoreExpenseInput = { amount: 4500, currency: "HUF", spentOn: "2026-10-10", categoryId: CAT, note: "ebéd", merchant: "Pizzéria" };

beforeEach(() => {
  state.sub = "user-1";
  state.insert.mockReset();
});

describe("restoreExpense (B-45: törlés visszavonása)", () => {
  it("érvényes adatból új kiadás: csak a felhasználói mezők mennek, a forrás-jelzőket a kliens nem küldi", async () => {
    expect(await restoreExpense(ok)).toEqual({ ok: true, data: { id: "new-id" } });
    expect(state.insert).toHaveBeenCalledWith({ amount: 4500, currency: "HUF", spent_on: "2026-10-10", category_id: CAT, note: "ebéd", merchant: "Pizzéria" });
    const sent = state.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(sent).not.toHaveProperty("source");
    expect(sent).not.toHaveProperty("is_provisional");
    expect(sent).not.toHaveProperty("user_id");
  });

  it("kategória, megjegyzés és kereskedő nélkül is felvehető", async () => {
    expect(await restoreExpense({ ...ok, categoryId: null, note: null, merchant: null })).toMatchObject({ ok: true });
  });

  it("érvénytelen bemenet → validation, nincs írás", async () => {
    const bad: Partial<RestoreExpenseInput>[] = [
      { amount: 0 },
      { amount: -5 },
      { amount: Number.NaN },
      { currency: "huf" },
      { currency: "FORINT" },
      { spentOn: "2026-1-1" },
      { spentOn: "holnap" },
      { categoryId: "nem-uuid" },
      { note: "x".repeat(201) },
      { merchant: "x".repeat(81) },
    ];
    for (const over of bad) {
      expect(await restoreExpense({ ...ok, ...over }), JSON.stringify(over)).toEqual({ ok: false, code: "validation" });
    }
    expect(state.insert).not.toHaveBeenCalled();
  });

  it("bejelentkezés nélkül nincs írás", async () => {
    state.sub = null;
    expect(await restoreExpense(ok)).toEqual({ ok: false, code: "unauthenticated" });
    expect(state.insert).not.toHaveBeenCalled();
  });
});
