import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { categoryName, type CategoryView } from "@/lib/category-icons";
import type { Locale } from "@/lib/i18n/config";
import { createClient } from "@/utils/supabase/server";
import type { ListItem, ListOccurrence, ListReminder } from "./group";

const client = async () => createClient(await cookies());

// Kategóriák (rendszer + saját) a megjelenítéshez: id → név/ikon/szín. Kérésenként egyszer.
export const getCategories = cache(async (locale: Locale): Promise<Map<string, CategoryView>> => {
  const { data } = await (await client())
    .from("categories")
    .select("id, name_hu, name_en, icon, color_slot")
    .order("sort");
  return new Map(
    (data ?? []).map((c) => [c.id, { id: c.id, icon: c.icon, colorSlot: c.color_slot, name: categoryName(c, locale) }]),
  );
});

// Az emlékeztetők + mindegyik KÖVETKEZŐ ki nem fizetett esedékessége (a lejártak elöl).
// Csak a ténylegesen használt oszlopok (H11); az esedékességeket az A-oldali v_occurrences adja.
export async function getReminderList(): Promise<ListItem[]> {
  const supabase = await client();
  const [reminders, occurrences] = await Promise.all([
    supabase
      .from("reminders")
      .select(
        "id, name, amount, currency, category_id, is_subscription, recur_unit, recur_every, start_date, month_end, remind_enabled, is_active, is_demo",
      )
      .order("name"),
    supabase
      .from("v_occurrences")
      .select("id, reminder_id, due_date, amount, currency")
      .eq("status", "upcoming")
      .order("due_date"),
  ]);

  // rendezett → a reminder első találata a legkorábbi (lejárt vagy legközelebbi) esedékesség
  const next = new Map<string, ListOccurrence>();
  for (const o of occurrences.data ?? []) {
    if (!o.reminder_id || !o.id || !o.due_date || o.amount === null || !o.currency || next.has(o.reminder_id)) continue;
    next.set(o.reminder_id, { id: o.id, due_date: o.due_date, amount: o.amount, currency: o.currency });
  }
  return (reminders.data ?? []).map((reminder: ListReminder) => ({ reminder, next: next.get(reminder.id) ?? null }));
}
