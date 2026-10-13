import { describe, expect, it } from "vitest";
import { defaultValues, valuesFromReminder, type ReminderRecord } from "@/lib/reminders/form-values";
import { toRecurrence } from "@/lib/schemas/reminder";

const record = (over: Partial<ReminderRecord> = {}): ReminderRecord => ({
  name: "Netflix",
  amount: 2300,
  currency: "HUF",
  category_id: null,
  service_slug: "netflix",
  is_subscription: true,
  recur_unit: "month",
  recur_every: 1,
  start_date: "2026-11-10",
  month_end: false,
  end_date: null,
  trial_ends_on: null,
  remind_enabled: true,
  remind_offsets: [3, 1],
  remind_time: "09:00:00",
  channels: ["push"],
  auto_paid: false,
  note: null,
  url: null,
  usage_tags: [],
  ...over,
});

describe("defaultValues (§1.2: okos alapértékek)", () => {
  const profile = { base_currency: "HUF", default_offsets: [1], default_notify_time: "09:00:00", channel_push: true, channel_email: false };

  it("havi ismétlődés, a mai nap, 1 nappal előtte 09:00-kor, a profil pénzneme", () => {
    const v = defaultValues("2026-10-13", profile);
    expect(v).toMatchObject({ recurrence: "month", startDate: "2026-10-13", offsets: [1], remindTime: "09:00", currency: "HUF", channelPush: true, channelEmail: false, remindEnabled: true });
  });
  it("üres profil-alapértelmezett offsetnél 1 nap", () => {
    expect(defaultValues("2026-10-13", { ...profile, default_offsets: [] }).offsets).toEqual([1]);
  });
  it("nem osztozik tömbön a profillal", () => {
    const o = [1, 3];
    const v = defaultValues("2026-10-13", { ...profile, default_offsets: o });
    v.offsets.push(7);
    expect(o).toEqual([1, 3]);
  });
});

describe("valuesFromReminder", () => {
  it("idő másodperc nélkül, offsetek rendezve, null-ok üres szöveggé", () => {
    const v = valuesFromReminder(record());
    expect(v.remindTime).toBe("09:00");
    expect(v.offsets).toEqual([1, 3]);
    expect(v.categoryId).toBe("");
    expect(v.note).toBe("");
    expect(v.amount).toBe("2300");
  });

  it("(unit, every) → mód, és vissza a toRecurrence()-szel ugyanaz (körút)", () => {
    const cases: [Partial<ReminderRecord>, string][] = [
      [{ recur_unit: null, recur_every: 1 }, "once"],
      [{ recur_unit: "week", recur_every: 1 }, "week"],
      [{ recur_unit: "month", recur_every: 1 }, "month"],
      [{ recur_unit: "year", recur_every: 1 }, "year"],
      [{ recur_unit: "month", recur_every: 3 }, "custom"],
      [{ recur_unit: "day", recur_every: 1 }, "custom"], // a "naponta" csak egyéniként érhető el
      [{ recur_unit: "week", recur_every: 2 }, "custom"],
    ];
    for (const [over, mode] of cases) {
      const r = record(over);
      const v = valuesFromReminder(r);
      expect(v.recurrence, JSON.stringify(over)).toBe(mode);
      expect(toRecurrence(v)).toEqual({ recur_unit: r.recur_unit, recur_every: r.recur_every });
    }
  });

  it("csatornák és címkék", () => {
    const v = valuesFromReminder(record({ channels: ["push", "email"], usage_tags: ["movies"] }));
    expect(v).toMatchObject({ channelPush: true, channelEmail: true, usageTags: ["movies"] });
    expect(valuesFromReminder(record({ channels: [] }))).toMatchObject({ channelPush: false, channelEmail: false });
  });
});
