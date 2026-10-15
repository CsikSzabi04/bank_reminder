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
  key:
    | "reminderDays"
    | "reminderTomorrow"
    | "reminderToday"
    | "reminderSnoozed"
    | "overdue"
    | "trialEnd"
    | "digest"
    | "test"
    | "budgetOver"
    | "budgetWatch"
    | "bankConsent"
    | "generic";
  values: { name?: string; amount?: number; currency?: string; date?: string; n?: number; count?: number; total?: number; names?: string; pct?: number };
  url: string;
};

const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A `locale` csak a payloadban kétnyelvű mezőkhöz (keret-riasztás: kategórianév) kell; alapértelmezés: magyar
export function describeNotification(row: NotificationRowLite, locale: "hu" | "en" = "hu"): NotificationView {
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
    // Keret-riasztás (A-45): {level, category_id, category_name_hu/en, month, spent, limit, pct, currency}; a mély link a kategória-részlet
    case "budget": {
      const categoryId = str(p.category_id);
      const name = (locale === "en" ? str(p.category_name_en) ?? str(p.category_name_hu) : str(p.category_name_hu) ?? str(p.category_name_en)) ?? "";
      const pct = num(p.pct);
      return {
        key: p.level === "over" ? "budgetOver" : "budgetWatch",
        values: { name, amount: num(p.spent), total: num(p.limit), currency: str(p.currency), pct: pct === undefined ? undefined : Math.round(pct) },
        url: categoryId && UUID.test(categoryId) ? `/budgets/${categoryId}` : "/budgets",
      };
    }
    // Kötelező bank-hozzáférés lejárat-értesítés (advanced.md §6): {bank, days_left, connection}; csak a bank neve és a hátralévő nap
    case "bank_consent":
      return { key: "bankConsent", values: { name: str(p.bank) ?? "", n: num(p.days_left) ?? 0 }, url: "/bank" };
    default:
      return { key: "generic", values: {}, url: "/dashboard" };
  }
}
