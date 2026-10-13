// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  uid: "user-1" as string | null,
  timezone: "Europe/Budapest",
  insert: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  rpc: vi.fn(),
  result: { data: { id: "11111111-1111-4111-8111-111111111111" }, error: null as { code?: string } | null },
}));

class Redirect extends Error {
  constructor(public url: string) {
    super(`redirect:${url}`);
  }
}

vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirect(url);
  },
}));
vi.mock("@/utils/supabase/server", () => ({
  createClient: () => {
    const chain = {
      select: () => ({ single: async () => state.result }),
      eq: (...args: unknown[]) => {
        state.eq(...args);
        return chain;
      },
    };
    return {
      auth: { getClaims: async () => ({ data: state.uid ? { claims: { sub: state.uid } } : null }) },
      rpc: state.rpc,
      from: (table: string) => {
        if (table === "profiles") {
          return { select: () => ({ eq: () => ({ single: async () => ({ data: { timezone: state.timezone } }) }) }) };
        }
        return {
          insert: (row: unknown) => (state.insert(row), chain),
          update: (row: unknown) => (state.update(row), chain),
        };
      },
    };
  },
}));
// a "server-only" csomag csak a Next build-ben értelmezett
vi.mock("server-only", () => ({}));

import { saveReminder } from "@/lib/reminders/form-actions";

const NEW_ID = "11111111-1111-4111-8111-111111111111";

function form(over: Record<string, string | string[]> = {}) {
  const base: Record<string, string | string[]> = {
    name: "Netflix",
    amount: "2 300",
    currency: "HUF",
    recurrence: "month",
    recurEvery: "1",
    startDate: "2099-01-10",
    remindEnabled: "on",
    channelPush: "on",
    remindTime: "09:00",
    offset: ["3", "1", "3"],
    ...over,
  };
  const fd = new FormData();
  for (const [k, v] of Object.entries(base)) for (const x of Array.isArray(v) ? v : [v]) fd.append(k, x);
  return fd;
}

beforeEach(() => {
  state.uid = "user-1";
  state.timezone = "Europe/Budapest";
  state.result = { data: { id: NEW_ID }, error: null };
  for (const m of [state.insert, state.update, state.eq, state.rpc]) m.mockReset();
  state.rpc.mockResolvedValue({ error: null });
});

describe("saveReminder", () => {
  it("új emlékeztető: a DB-sor helyesen áll össze, a mentés után refresh_tips és átirányítás a részletekre", async () => {
    await expect(saveReminder(null, null, form())).rejects.toMatchObject({ url: `/reminders/${NEW_ID}` });
    const row = state.insert.mock.calls[0][0];
    expect(row).toMatchObject({
      name: "Netflix",
      amount: 2300,
      currency: "HUF",
      recur_unit: "month",
      recur_every: 1,
      start_date: "2099-01-10",
      month_end: false,
      remind_enabled: true,
      remind_offsets: [1, 3], // egyedi, rendezett
      remind_time: "09:00",
      channels: ["push"],
      category_id: null,
      service_slug: null,
    });
    expect(row).not.toHaveProperty("user_id"); // az identitás a DB-ből jön (auth.uid() default), nem a kliensből
    expect(state.rpc).toHaveBeenCalledWith("refresh_tips");
  });

  it("szerkesztés: update az adott azonosítóra, nem insert", async () => {
    await expect(saveReminder(NEW_ID, null, form())).rejects.toMatchObject({ url: `/reminders/${NEW_ID}` });
    expect(state.insert).not.toHaveBeenCalled();
    expect(state.update).toHaveBeenCalledTimes(1);
    expect(state.eq).toHaveBeenCalledWith("id", NEW_ID);
  });

  it("egyszeri tétel: unit null, every 1; a month_end csak havi módban érvényes", async () => {
    await expect(saveReminder(null, null, form({ recurrence: "once", monthEnd: "on" }))).rejects.toBeInstanceOf(Redirect);
    expect(state.insert.mock.calls[0][0]).toMatchObject({ recur_unit: null, recur_every: 1, month_end: false });
  });

  it("egyéni ismétlődés és csatornák", async () => {
    await expect(
      saveReminder(null, null, form({ recurrence: "custom", recurUnit: "week", recurEvery: "2", channelEmail: "on" })),
    ).rejects.toBeInstanceOf(Redirect);
    expect(state.insert.mock.calls[0][0]).toMatchObject({ recur_unit: "week", recur_every: 2, channels: ["push", "email"] });
  });

  it("múltbeli első esedékesség ÚJ emlékeztetőnél → mező-hiba, nincs beszúrás; szerkesztésnél megengedett", async () => {
    const res = await saveReminder(null, null, form({ startDate: "2020-01-01" }));
    expect(res).toMatchObject({ ok: false, code: "validation", fieldErrors: { startDate: ["startInPast"] } });
    expect(state.insert).not.toHaveBeenCalled();

    await expect(saveReminder(NEW_ID, null, form({ startDate: "2020-01-01" }))).rejects.toBeInstanceOf(Redirect);
  });

  it("érvénytelen adat → mező-hibák, nincs DB-hívás (a szerver újra-validál)", async () => {
    const res = await saveReminder(null, null, form({ name: "", amount: "-5" }));
    expect(res).toMatchObject({ ok: false, code: "validation" });
    expect(res.ok === false && Object.keys(res.fieldErrors ?? {})).toEqual(expect.arrayContaining(["name", "amount"]));
    expect(state.insert).not.toHaveBeenCalled();
  });

  it("bejelentkezés nélkül unauthenticated, nincs DB-írás", async () => {
    state.uid = null;
    expect(await saveReminder(null, null, form())).toEqual({ ok: false, code: "unauthenticated" });
    expect(state.insert).not.toHaveBeenCalled();
  });

  it("rossz azonosító szerkesztésnél → validation", async () => {
    expect(await saveReminder("nem-uuid", null, form())).toEqual({ ok: false, code: "validation" });
  });

  it("DB-hiba leképezve (hivatkozott kategória nem létezik → validation), nincs átirányítás és nincs refresh_tips", async () => {
    state.result = { data: null as never, error: { code: "23503" } };
    expect(await saveReminder(null, null, form())).toEqual({ ok: false, code: "validation" });
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it("a kliens által küldött user_id mező nem kerül a sorba", async () => {
    await expect(saveReminder(null, null, form({ user_id: "másik-felhasználó" }))).rejects.toBeInstanceOf(Redirect);
    expect(state.insert.mock.calls[0][0]).not.toHaveProperty("user_id");
  });
});
