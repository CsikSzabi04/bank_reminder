// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  uid: "user-1" as string | null,
  email: "anna@example.com",
  updateUser: vi.fn(),
  signOut: vi.fn(),
  invoke: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  del: vi.fn(),
  eq: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({}), headers: async () => new Headers({ origin: "https://app.example" }) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    state.redirect(to);
    throw new Error("NEXT_REDIRECT");
  },
}));
vi.mock("@/utils/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getClaims: async () => ({ data: state.uid ? { claims: { sub: state.uid } } : null }),
      getUser: async () => ({ data: { user: state.uid ? { id: state.uid, email: state.email } : null } }),
      updateUser: state.updateUser,
      signOut: state.signOut,
    },
    functions: { invoke: state.invoke },
    from: () => ({
      update: (row: unknown) => ({ eq: async (...a: unknown[]) => (state.update(row), state.eq(...a), { error: null }) }),
      insert: async (row: unknown) => (state.insert(row), { error: null }),
      delete: () => ({ eq: async (...a: unknown[]) => (state.del(...a), { error: null }) }),
    }),
  }),
}));

import { deleteAccount } from "@/lib/profile/delete-account";
import { deleteCategory, saveCategory, saveFinance } from "@/lib/profile/finance-actions";
import { changeEmail, changePassword } from "@/lib/profile/security-actions";

const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

beforeEach(() => {
  state.uid = "user-1";
  state.email = "anna@example.com";
  for (const m of [state.updateUser, state.signOut, state.invoke, state.update, state.insert, state.del, state.eq, state.redirect]) m.mockReset();
  state.updateUser.mockResolvedValue({ error: null });
  state.invoke.mockResolvedValue({ data: { ok: true }, error: null });
});

describe("deleteAccount (GDPR, §19.4)", () => {
  it("🔴 megerősítő szó nélkül / rosszul NEM hívja az Edge Function-t", async () => {
    for (const confirm of ["", "töröl", "yes", "DELETED", " "]) {
      const res = await deleteAccount(null, fd({ confirm }));
      expect(res).toMatchObject({ ok: false, code: "validation", fieldErrors: { confirm: ["confirmMismatch"] } });
    }
    expect(state.invoke).not.toHaveBeenCalled();
  });
  it("TÖRLÖM / DELETE (kis- és nagybetűtől függetlenül) → Edge Function a DELETE-megerősítéssel, kijelentkezés, búcsú-oldal", async () => {
    for (const confirm of ["TÖRLÖM", "törlöm", "DELETE", " delete "]) {
      state.invoke.mockClear();
      state.redirect.mockClear();
      await expect(deleteAccount(null, fd({ confirm }))).rejects.toThrow("NEXT_REDIRECT");
      expect(state.invoke).toHaveBeenCalledWith("delete-account", { body: { confirm: "DELETE" } });
      expect(state.redirect).toHaveBeenCalledWith("/goodbye");
    }
    expect(state.signOut).toHaveBeenCalled();
  });
  it("kijelentkezve nem hív semmit; a függvény hibája nem irányít át", async () => {
    state.uid = null;
    expect(await deleteAccount(null, fd({ confirm: "DELETE" }))).toMatchObject({ ok: false, code: "unauthenticated" });
    expect(state.invoke).not.toHaveBeenCalled();

    state.uid = "user-1";
    state.invoke.mockResolvedValue({ data: null, error: { context: { status: 500 } } });
    expect(await deleteAccount(null, fd({ confirm: "DELETE" }))).toMatchObject({ ok: false, code: "upstream_failed" });
    expect(state.redirect).not.toHaveBeenCalled();
    state.invoke.mockResolvedValue({ data: null, error: { context: { status: 401 } } });
    expect(await deleteAccount(null, fd({ confirm: "DELETE" }))).toMatchObject({ ok: false, code: "unauthenticated" });
  });
});

describe("changePassword / changeEmail", () => {
  it("jelszó: gyenge / eltérő megerősítés → mezőhiba, nincs hívás", async () => {
    const weak = await changePassword(null, fd({ password: "abc", confirm: "abc" }));
    expect(weak).toMatchObject({ ok: false, code: "validation" });
    const mismatch = await changePassword(null, fd({ password: "Jelszo1234", confirm: "Jelszo9999" }));
    expect(mismatch).toMatchObject({ ok: false, fieldErrors: { confirm: ["mismatch"] } });
    expect(state.updateUser).not.toHaveBeenCalled();
  });
  it("jelszó: siker; a jelölőnégyzet a többi munkamenetet is lezárja", async () => {
    expect(await changePassword(null, fd({ password: "Jelszo1234", confirm: "Jelszo1234" }))).toEqual({ ok: true });
    expect(state.updateUser).toHaveBeenCalledWith({ password: "Jelszo1234" });
    expect(state.signOut).not.toHaveBeenCalled();
    await changePassword(null, fd({ password: "Jelszo1234", confirm: "Jelszo1234", signOutOthers: "on" }));
    expect(state.signOut).toHaveBeenCalledWith({ scope: "others" });
  });
  it("jelszó: régi session → újrabelépést kérő ok", async () => {
    state.updateUser.mockResolvedValue({ error: { code: "reauthentication_needed", status: 401 } });
    expect(await changePassword(null, fd({ password: "Jelszo1234", confirm: "Jelszo1234" }))).toMatchObject({ ok: false, reason: "reauthNeeded" });
  });
  it("e-mail: azonos cím elutasítva; érvényes új cím → megerősítő link az app saját /auth/confirm-jére", async () => {
    expect(await changeEmail(null, fd({ email: "ANNA@example.com" }))).toMatchObject({ ok: false, fieldErrors: { email: ["sameEmail"] } });
    expect(await changeEmail(null, fd({ email: "nem-email" }))).toMatchObject({ ok: false, code: "validation" });
    expect(state.updateUser).not.toHaveBeenCalled();

    expect(await changeEmail(null, fd({ email: "uj@example.com" }))).toEqual({ ok: true });
    const [attrs, opts] = state.updateUser.mock.calls[0];
    expect(attrs).toEqual({ email: "uj@example.com" });
    expect(opts.emailRedirectTo).toBe("https://app.example/auth/confirm?next=%2Fprofile%3Fsection%3Dsecurity");
  });
});

describe("saveFinance", () => {
  const ok = { currency: "EUR", timezone: "Europe/Budapest", income: "450 000" };
  it("érvényes: pénznem, időzóna, jövedelem szám; üres jövedelem → null", async () => {
    expect(await saveFinance(null, fd(ok))).toEqual({ ok: true });
    expect(state.update).toHaveBeenLastCalledWith({ base_currency: "EUR", timezone: "Europe/Budapest", monthly_income: 450000 });
    await saveFinance(null, fd({ ...ok, income: "" }));
    expect(state.update).toHaveBeenLastCalledWith({ base_currency: "EUR", timezone: "Europe/Budapest", monthly_income: null });
  });
  it.each([
    ["ismeretlen pénznem", { ...ok, currency: "XXX" }, "currency"],
    ["érvénytelen időzóna", { ...ok, timezone: "Nem/Letezik" }, "timezone"],
    ["negatív jövedelem", { ...ok, income: "-5" }, "income"],
    ["szöveges jövedelem", { ...ok, income: "sok" }, "income"],
  ])("%s → mezőhiba, nincs írás", async (_n, input, field) => {
    const res = await saveFinance(null, fd(input));
    expect(res).toMatchObject({ ok: false, code: "validation" });
    expect(res.ok === false && res.fieldErrors?.[field]).toBeTruthy();
    expect(state.update).not.toHaveBeenCalled();
  });
});

describe("saveCategory / deleteCategory", () => {
  const ok = { nameHu: "Háziállat", nameEn: "", icon: "tag", colorSlot: "3", kind: "expense" };
  it("új kategória: a név legalább az egyik nyelven; a mezők a DB-oszlopokra képződnek", async () => {
    expect(await saveCategory(null, null, fd(ok))).toEqual({ ok: true });
    expect(state.insert).toHaveBeenCalledWith({ name_hu: "Háziállat", name_en: null, icon: "tag", color_slot: 3, kind: "expense", user_id: "user-1" });
  });
  it.each([
    ["név nélkül", { ...ok, nameHu: "" }, "nameHu"],
    ["ismeretlen ikon", { ...ok, icon: "rocket" }, "icon"],
    ["a 8-as (piros) szín nincs kiosztva", { ...ok, colorSlot: "8" }, "colorSlot"],
    ["ismeretlen típus", { ...ok, kind: "x" }, "kind"],
    ["túl hosszú név", { ...ok, nameHu: "x".repeat(41) }, "nameHu"],
  ])("%s → mezőhiba, nincs írás", async (_n, input, field) => {
    const res = await saveCategory(null, null, fd(input));
    expect(res.ok === false && res.fieldErrors?.[field]).toBeTruthy();
    expect(state.insert).not.toHaveBeenCalled();
  });
  it("szerkesztés id szerint, érvénytelen azonosító elutasítva; törlés csak UUID-dal", async () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(await saveCategory(id, null, fd(ok))).toEqual({ ok: true });
    expect(state.eq).toHaveBeenCalledWith("id", id);
    expect(await saveCategory("nem-uuid", null, fd(ok))).toMatchObject({ ok: false });
    expect(await deleteCategory("nem-uuid")).toMatchObject({ ok: false });
    expect(await deleteCategory(id)).toEqual({ ok: true });
    expect(state.del).toHaveBeenCalledWith("id", id);
  });
});
