import { daysUntil } from "@/lib/due";

// Egy lista-elem: az emlékeztető + a következő (ki nem fizetett) esedékessége
export type ListReminder = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  category_id: string | null;
  is_subscription: boolean;
  recur_unit: string | null;
  recur_every: number;
  start_date: string;
  month_end: boolean;
  remind_enabled: boolean;
  is_active: boolean;
  is_demo: boolean;
  // külső hivatkozás (pl. a vásárlás oldala) — a „Megnyitás ↗” gombhoz
  url: string | null;
};

export type ListOccurrence = {
  id: string;
  due_date: string;
  amount: number;
  currency: string;
};

export type ListItem = { reminder: ListReminder; next: ListOccurrence | null };

export const GROUP_ORDER = ["overdue", "thisWeek", "laterThisMonth", "nextMonth", "later", "paused", "done"] as const;
export type GroupKey = (typeof GROUP_ORDER)[number];

export const FILTERS = ["all", "bills", "subscriptions", "overdue"] as const;
export type Filter = (typeof FILTERS)[number];
export const SORTS = ["due", "amount", "name"] as const;
export type Sort = (typeof SORTS)[number];

export const isFilter = (v: string | undefined): v is Filter => (FILTERS as readonly string[]).includes(v ?? "");
export const isSort = (v: string | undefined): v is Sort => (SORTS as readonly string[]).includes(v ?? "");

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

// A hét vasárnapja ("YYYY-MM-DD"): a hét hétfőn kezdődik (§20.3)
export function endOfWeek(today: string): string {
  const dow = (day(today).getUTCDay() + 6) % 7; // 0 = hétfő … 6 = vasárnap
  const end = day(today);
  end.setUTCDate(end.getUTCDate() + (6 - dow));
  return end.toISOString().slice(0, 10);
}

// "YYYY-MM" hónap-kulcs, `offset` hónappal eltolva
function monthKey(iso: string, offset = 0): string {
  const d = day(iso);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + offset);
  return d.toISOString().slice(0, 7);
}

export function groupOf(item: ListItem, today: string): GroupKey {
  if (!item.reminder.is_active) return "paused";
  if (!item.next) return "done";
  const due = item.next.due_date;
  if (daysUntil(due, today) < 0) return "overdue";
  if (due <= endOfWeek(today)) return "thisWeek";
  const m = due.slice(0, 7);
  if (m === monthKey(today)) return "laterThisMonth";
  if (m === monthKey(today, 1)) return "nextMonth";
  return "later";
}

// Ékezet- és kisbetű-független keresés ("aram" megtalálja az "Áram"-ot)
export const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export function filterItems(items: ListItem[], opts: { filter: Filter; q: string }, today: string): ListItem[] {
  const q = fold(opts.q.trim());
  return items.filter(({ reminder, next }) => {
    if (q && !fold(reminder.name).includes(q)) return false;
    switch (opts.filter) {
      case "bills":
        return !reminder.is_subscription;
      case "subscriptions":
        return reminder.is_subscription;
      case "overdue":
        return reminder.is_active && next !== null && daysUntil(next.due_date, today) < 0;
      default:
        return true;
    }
  });
}

export function sortItems(items: ListItem[], sort: Sort, locale: string): ListItem[] {
  const copy = [...items];
  const byName = (a: ListItem, b: ListItem) => a.reminder.name.localeCompare(b.reminder.name, locale);
  copy.sort((a, b) => {
    if (sort === "name") return byName(a, b);
    if (sort === "amount") {
      return (b.next?.amount ?? b.reminder.amount) - (a.next?.amount ?? a.reminder.amount) || byName(a, b);
    }
    // esedékesség szerint; a lezártak/szüneteltek (nincs dátum) a végére
    const da = a.next?.due_date ?? "9999-12-31";
    const db = b.next?.due_date ?? "9999-12-31";
    return da < db ? -1 : da > db ? 1 : byName(a, b);
  });
  return copy;
}

export function groupItems(items: ListItem[], today: string): Record<GroupKey, ListItem[]> {
  const groups = Object.fromEntries(GROUP_ORDER.map((k) => [k, [] as ListItem[]])) as Record<GroupKey, ListItem[]>;
  for (const item of items) groups[groupOf(item, today)].push(item);
  return groups;
}
