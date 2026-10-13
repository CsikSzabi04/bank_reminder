// Az in-app értesítés leírása (kulcs + értékek): a szöveget a `locales`-ból a hívó építi, így a nyelvváltás azonnal hat.
// A `notifications.payload` csak adat (A-12): reminder → name/amount/currency/due_date/offset/occ …

export type NotificationRowLite = {
  kind: string;
  payload: unknown;
  reminder_id: string | null;
  occurrence_id: string | null;
};

export type NotificationView = {
  /** `notifications.text.<key>.title|body` */
  key: "reminderDays" | "reminderTomorrow" | "reminderToday" | "reminderSnoozed" | "overdue" | "trialEnd" | "digest" | "test" | "generic";
  values: { name?: string; amount?: number; currency?: string; date?: string; n?: number; count?: number; total?: number; names?: string };
  url: string;
};

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

export function describeNotification(row: NotificationRowLite): NotificationView {
  const p = (row.payload && typeof row.payload === "object" ? row.payload : {}) as Record<string, unknown>;
  const base = { name: str(p.name), amount: num(p.amount), currency: str(p.currency), date: str(p.due_date) };
  // mély link: a részletoldal, relatív (soha nem a payloadból átvett idegen URL)
  const url = row.reminder_id
    ? `/reminders/${row.reminder_id}${row.occurrence_id ? `?occ=${row.occurrence_id}` : ""}`
    : "/dashboard";

  switch (row.kind) {
    case "reminder": {
      if (p.snoozed === true) return { key: "reminderSnoozed", values: base, url };
      const offset = num(p.offset);
      if (offset === 0) return { key: "reminderToday", values: base, url };
      if (offset === 1) return { key: "reminderTomorrow", values: base, url };
      return { key: "reminderDays", values: { ...base, n: offset ?? 0 }, url };
    }
    case "overdue":
      return { key: "overdue", values: base, url };
    case "trial_end":
      return { key: "trialEnd", values: { name: base.name }, url };
    case "digest": {
      const items = Array.isArray(p.items) ? p.items : [];
      const names = items
        .map((i) => (i && typeof i === "object" ? str((i as Record<string, unknown>).name) : undefined))
        .filter(Boolean)
        .join(", ");
      return { key: "digest", values: { count: num(p.count) ?? items.length, total: num(p.total), currency: str(p.base_currency), names }, url: "/calendar" };
    }
    case "test":
      return { key: "test", values: {}, url: "/profile?section=notifications" };
    default:
      return { key: "generic", values: {}, url: "/dashboard" };
  }
}
