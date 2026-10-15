// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  uid: "user-1" as string | null,
  rpc: vi.fn(),
  invoke: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  markPaid: vi.fn(),
  snooze: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({}),
  headers: async () => new Headers({ "user-agent": "UA/" + "x".repeat(400) }),
}));
vi.mock("@/utils/supabase/server", () => ({
  createClient: () => ({
    auth: { getClaims: async () => ({ data: state.uid ? { claims: { sub: state.uid } } : null }) },
    rpc: state.rpc,
    functions: { invoke: state.invoke },
    from: () => ({ update: (row: unknown) => ({ eq: async (...a: unknown[]) => (state.update(row), state.eq(...a), { error: null }) }) }),
  }),
}));
vi.mock("@/lib/reminders/actions", () => ({ markPaid: state.markPaid, snoozeOccurrence: state.snooze }));

import { POST as occurrencePost } from "@/app/api/occurrences/[id]/[action]/route";
import { markNotificationsRead, savePushSubscription, sendTestPush, updateNotificationSettings } from "@/lib/push/actions";

const sub = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc",
  keys: { p256dh: "B".repeat(87).replace(/B/g, "A"), auth: "a".repeat(22) },
  platform: "windows" as const,
  label: "Chrome · Windows",
};

beforeEach(() => {
  state.uid = "user-1";
  for (const m of [state.rpc, state.invoke, state.update, state.eq, state.markPaid, state.snooze]) m.mockReset();
  state.rpc.mockResolvedValue({ error: null });
});

describe("savePushSubscription", () => {
  it("érvényes feliratkozás: az RPC a megfelelő argumentumokkal, a user-agent csonkolva", async () => {
    expect(await savePushSubscription(sub)).toEqual({ ok: true });
    const [fn, args] = state.rpc.mock.calls[0];
    expect(fn).toBe("register_push_subscription");
    expect(args).toMatchObject({ p_endpoint: sub.endpoint, p_platform: "windows", p_label: "Chrome · Windows" });
    expect(args.p_user_agent.length).toBe(300);
  });
  it("nem https végpont, rossz kulcs-karakterek, ismeretlen platform → elutasítva, nincs RPC", async () => {
    for (const bad of [
      { ...sub, endpoint: "http://fcm.googleapis.com/x" },
      { ...sub, endpoint: "javascript:alert(1)" },
      { ...sub, keys: { ...sub.keys, auth: "nem base64url!" } },
      { ...sub, platform: "toaster" as never },
      { ...sub, label: "x".repeat(61) },
    ]) {
      expect(await savePushSubscription(bad)).toEqual({ ok: false, code: "validation" });
    }
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("az RPC hibakódjai: eszköz-limit és tiltott host", async () => {
    state.rpc.mockResolvedValueOnce({ error: { code: "53400" } });
    expect(await savePushSubscription(sub)).toEqual({ ok: false, code: "limit_reached" });
    state.rpc.mockResolvedValueOnce({ error: { code: "23514" } });
    expect(await savePushSubscription(sub)).toEqual({ ok: false, code: "validation" });
  });
});

describe("sendTestPush", () => {
  it("siker: elküldött / eszközök száma", async () => {
    state.invoke.mockResolvedValue({ data: { ok: true, sent: 2, devices: 3 }, error: null });
    expect(await sendTestPush()).toEqual({ ok: true, data: { sent: 2, devices: 3 } });
    expect(state.invoke).toHaveBeenCalledWith("send-test-push", { body: {} });
  });
  it("429 → rate_limited, 401 → unauthenticated, egyéb hiba → upstream_failed", async () => {
    state.invoke.mockResolvedValueOnce({ data: null, error: { context: { status: 429 } } });
    expect(await sendTestPush()).toEqual({ ok: false, code: "rate_limited" });
    state.invoke.mockResolvedValueOnce({ data: null, error: { context: { status: 401 } } });
    expect(await sendTestPush()).toEqual({ ok: false, code: "unauthenticated" });
    state.invoke.mockResolvedValueOnce({ data: null, error: { context: { status: 500 } } });
    expect(await sendTestPush()).toEqual({ ok: false, code: "upstream_failed" });
    state.invoke.mockResolvedValueOnce({ data: { ok: false, devices: 1 }, error: null });
    expect(await sendTestPush()).toEqual({ ok: false, code: "upstream_failed" });
  });
  it("a push-szolgáltató státuszai átjutnak a hibában (diagnosztika); nincs aktív eszköz nem hiba", async () => {
    state.invoke.mockResolvedValueOnce({ data: { ok: false, sent: 0, devices: 2, errors: ["ios:403", "windows:410", 7] }, error: null });
    expect(await sendTestPush()).toEqual({ ok: false, code: "upstream_failed", message: "ios:403, windows:410" });
    state.invoke.mockResolvedValueOnce({ data: { ok: false, sent: 0, devices: 0, errors: ["no_active_subscription"] }, error: null });
    expect(await sendTestPush()).toEqual({ ok: true, data: { sent: 0, devices: 0 } });
  });
});

describe("updateNotificationSettings", () => {
  const form = (over: Record<string, string | string[]> = {}) => {
    const base: Record<string, string | string[]> = { remindersEnabled: "on", notifyTime: "08:30", channelPush: "on", offset: ["3", "1", "3"], ...over };
    const fd = new FormData();
    for (const [k, v] of Object.entries(base)) for (const x of Array.isArray(v) ? v : [v]) fd.append(k, x);
    return fd;
  };
  it("a mezők a profil oszlopaira képeződnek; az offsetek egyediek és rendezettek", async () => {
    expect(await updateNotificationSettings(null, form({ hideDetails: "on" }))).toEqual({ ok: true });
    expect(state.update).toHaveBeenCalledWith({
      reminders_enabled: true,
      default_offsets: [1, 3],
      default_notify_time: "08:30",
      channel_push: true,
      channel_email: false,
      notify_hide_details: true,
      weekly_digest: false,
      budget_alerts: false,
    });
    expect(state.eq).toHaveBeenCalledWith("id", "user-1");
  });
  it("a keret-riasztás kapcsoló a budget_alerts oszlopra képeződik, a főkapcsolótól függetlenül", async () => {
    const fd = form({ budgetAlerts: "on" });
    fd.delete("remindersEnabled");
    await updateNotificationSettings(null, fd);
    expect(state.update.mock.calls[0][0]).toMatchObject({ reminders_enabled: false, budget_alerts: true });
    state.update.mockClear();
    await updateNotificationSettings(null, form());
    expect(state.update.mock.calls[0][0].budget_alerts).toBe(false);
  });
  it("kikapcsolt főkapcsoló mentődik (hiányzó jelölőnégyzet = hamis)", async () => {
    const fd = form();
    fd.delete("remindersEnabled");
    await updateNotificationSettings(null, fd);
    expect(state.update.mock.calls[0][0].reminders_enabled).toBe(false);
  });
  it("érvénytelen idő / túl sok / tartományon kívüli offset → mező-hiba, nincs írás", async () => {
    const cases: [Record<string, string | string[]>, string][] = [
      [{ notifyTime: "25:99" }, "notifyTime"],
      [{ offset: ["0", "1", "2", "3", "4", "5"] }, "offsets"],
      [{ offset: ["31"] }, "offsets"],
    ];
    for (const [over, field] of cases) {
      const res = await updateNotificationSettings(null, form(over));
      expect(res.ok === false && Object.keys(res.fieldErrors ?? {})).toContain(field);
    }
    expect(state.update).not.toHaveBeenCalled();
  });
  it("bejelentkezés nélkül nincs írás", async () => {
    state.uid = null;
    expect(await updateNotificationSettings(null, form())).toEqual({ ok: false, code: "unauthenticated" });
  });
});

describe("markNotificationsRead", () => {
  it("azonosító nélkül mind; érvénytelen azonosítóra elutasít", async () => {
    expect(await markNotificationsRead()).toEqual({ ok: true });
    expect(state.rpc).toHaveBeenCalledWith("mark_notifications_read", {});
    expect(await markNotificationsRead(["nem-uuid"])).toEqual({ ok: false, code: "validation" });
    const id = "11111111-2222-4333-8444-555555555555";
    await markNotificationsRead([id]);
    expect(state.rpc).toHaveBeenLastCalledWith("mark_notifications_read", { p_ids: [id] });
  });
});

describe("POST /api/occurrences/[id]/[action] (SW értesítés-gombok)", () => {
  const ID = "11111111-2222-4333-8444-555555555555";
  const call = (id: string, action: string, origin: string | null = "http://localhost:3000") => {
    const headers = new Headers();
    if (origin) headers.set("origin", origin);
    return occurrencePost(new NextRequest(`http://localhost:3000/api/occurrences/${id}/${action}`, { method: "POST", headers }), {
      params: Promise.resolve({ id, action }),
    } as never);
  };
  it("idegen vagy hiányzó Origin → 403, nincs művelet", async () => {
    expect((await call(ID, "paid", "https://evil.example")).status).toBe(403);
    expect((await call(ID, "paid", null)).status).toBe(403);
    expect(state.markPaid).not.toHaveBeenCalled();
  });
  it("rossz azonosító 400, ismeretlen művelet 404", async () => {
    expect((await call("nem-uuid", "paid")).status).toBe(400);
    expect((await call(ID, "delete")).status).toBe(404);
    expect(state.markPaid).not.toHaveBeenCalled();
  });
  it("paid → markPaid; snooze → holnapra halaszt; a státusz az eredményből jön", async () => {
    state.markPaid.mockResolvedValue({ ok: true });
    expect((await call(ID, "paid")).status).toBe(200);
    expect(state.markPaid).toHaveBeenCalledWith(ID);
    state.snooze.mockResolvedValue({ ok: false, code: "not_found" });
    expect((await call(ID, "snooze")).status).toBe(404);
    expect(state.snooze).toHaveBeenCalledWith(ID, 1);
    state.markPaid.mockResolvedValue({ ok: false, code: "unauthenticated" });
    expect((await call(ID, "paid")).status).toBe(401);
  });
});
