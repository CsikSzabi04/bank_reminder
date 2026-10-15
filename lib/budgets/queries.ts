import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { categoryName } from "@/lib/category-icons";
import type { Locale } from "@/lib/i18n/config";
import { shiftMonth } from "@/lib/dashboard";
import { addDays } from "@/lib/tz";
import { createClient } from "@/utils/supabase/server";

const client = async () => createClient(await cookies());

export type BudgetRow = {
  budgetId: string;
  categoryId: string;
  limit: number;
  spent: number;
  committed: number;
  left: number;
  state: "ok" | "watch" | "over";
  forecast: number | null;
  suggested: number | null;
};

const asState = (s: string): BudgetRow["state"] => (s === "over" || s === "watch" ? s : "ok");

// Kerek-státusz: a spent/committed/left/state az SQL-ből (A-11), itt csak típusra alakítjuk
export async function getBudgetStatus(month: string): Promise<BudgetRow[]> {
  const { data } = await (await client()).rpc("budget_status", { p_month: month });
  return (data ?? []).map((r) => ({
    budgetId: r.budget_id,
    categoryId: r.category_id,
    limit: r.monthly_limit,
    spent: r.spent,
    committed: r.committed,
    left: r.left,
    state: asState(r.state),
    forecast: r.forecast,
    suggested: r.suggested_limit,
  }));
}

export async function getBudgetSuggestions(month: string): Promise<Map<string, number>> {
  const { data } = await (await client()).rpc("budget_suggestions", { p_month: month });
  return new Map((data ?? []).map((r) => [r.category_id, r.suggested_limit]));
}

export type CategoryOption = { id: string; name: string; icon: string; colorSlot: number; kind: string };

// Minden kategória (rendszer + saját) a választókhoz; a számla- és a kiadás-kategóriák egyaránt keretezhetők
export const getCategoryOptions = cache(async (locale: Locale): Promise<CategoryOption[]> => {
  const { data } = await (await client()).from("categories").select("id, name_hu, name_en, icon, color_slot, kind").order("sort");
  return (data ?? []).map((c) => ({ id: c.id, name: categoryName(c, locale), icon: c.icon, colorSlot: c.color_slot, kind: c.kind }));
});

// Gyors kiadás kategória-chipjei: a leggyakrabban használtak elöl (az utolsó 90 nap kiadásai szerint, darabszám = nem pénz)
export async function getFrequentExpenseCategories(locale: Locale, today: string): Promise<CategoryOption[]> {
  const supabase = await client();
  const [options, recent] = await Promise.all([
    getCategoryOptions(locale),
    supabase.from("expenses").select("category_id").gte("spent_on", addDays(today, -90)).limit(500),
  ]);
  const counts = new Map<string, number>();
  for (const r of recent.data ?? []) if (r.category_id) counts.set(r.category_id, (counts.get(r.category_id) ?? 0) + 1);
  return options
    .filter((c) => c.kind === "expense" || c.kind === "both")
    .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
}

export type CategoryItem =
  | { kind: "bill"; id: string; reminderId: string; name: string; date: string; amount: number; currency: string; status: string }
  | {
      kind: "expense";
      id: string;
      name: string;
      date: string;
      amount: number;
      currency: string;
      // a tétel forrása: kézi · értesítésből · banki szinkronból; az ideiglenes (értesítés-eredetű) tételt a bank még nem erősítette meg
      source: "manual" | "notification" | "bank";
      provisional: boolean;
      // a visszavonáshoz (törlés után újra felvehető ugyanazokkal az adatokkal)
      note: string | null;
      merchant: string | null;
    };

const expenseSource = (value: string): "manual" | "notification" | "bank" => (value === "notification" || value === "bank" ? value : "manual");

// A kategória hónapjának tételei: számlák (esedékesség szerint) + gyors kiadások, időrendben
export async function getCategoryItems(categoryId: string, month: string): Promise<CategoryItem[]> {
  const supabase = await client();
  const to = addDays(shiftMonth(month, 1), -1);
  const [bills, expenses] = await Promise.all([
    supabase
      .from("v_occurrences")
      .select("id, reminder_id, reminder_name, due_date, amount, currency, status, paid_amount")
      .eq("category_id", categoryId)
      .neq("status", "skipped")
      .gte("due_date", month)
      .lte("due_date", to),
    supabase.from("expenses").select("id, note, spent_on, amount, currency, source, is_provisional, merchant").eq("category_id", categoryId).gte("spent_on", month).lte("spent_on", to),
  ]);
  const items: CategoryItem[] = [
    ...(bills.data ?? []).flatMap((b) =>
      b.id && b.reminder_id && b.due_date
        ? [{ kind: "bill" as const, id: b.id, reminderId: b.reminder_id, name: b.reminder_name ?? "", date: b.due_date, amount: (b.status === "paid" ? b.paid_amount : null) ?? b.amount ?? 0, currency: b.currency ?? "HUF", status: b.status ?? "upcoming" }]
        : [],
    ),
    ...(expenses.data ?? []).map((e) => ({
      kind: "expense" as const,
      id: e.id,
      // az automatikus tételnél a kereskedő a név; kézinél a megjegyzés
      name: e.merchant ?? e.note ?? "",
      date: e.spent_on,
      amount: e.amount,
      currency: e.currency,
      source: expenseSource(e.source),
      provisional: e.is_provisional,
      note: e.note,
      merchant: e.merchant,
    })),
  ];
  return items.sort((a, b) => a.date.localeCompare(b.date));
}
