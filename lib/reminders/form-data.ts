import "server-only";
import { cookies } from "next/headers";
import type { CategoryOption } from "@/components/reminders/form/reminder-form";
import type { CatalogItem } from "@/components/reminders/form/service-picker";
import { categoryName } from "@/lib/category-icons";
import type { Locale } from "@/lib/i18n/config";
import { createClient } from "@/utils/supabase/server";
import type { ProfileDefaults, ReminderRecord } from "./form-values";

const client = async () => createClient(await cookies());

// Az űrlap referencia-adatai: kategóriák (számlához való), katalógus (csak név + kategória, ár nincs: H7)
// és a profil alapértékei. Csak a ténylegesen használt oszlopok (H11).
export async function getFormReference(locale: Locale, userId: string) {
  const supabase = await client();
  const [categories, catalog, profile] = await Promise.all([
    supabase.from("categories").select("id, key, name_hu, name_en, kind").in("kind", ["bill", "both"]).order("sort"),
    supabase.from("service_catalog").select("slug, name, category_key").eq("is_active", true).order("name"),
    supabase
      .from("profiles")
      .select("base_currency, default_offsets, default_notify_time, channel_push, channel_email, timezone")
      .eq("id", userId)
      .single(),
  ]);

  const categoryOptions: CategoryOption[] = (categories.data ?? []).map((c) => ({
    id: c.id,
    key: c.key ?? "", // saját kategóriának nincs key-e
    name: categoryName(c, locale),
  }));
  const catalogItems: CatalogItem[] = (catalog.data ?? []).map((c) => ({
    slug: c.slug,
    name: c.name,
    categoryKey: c.category_key,
  }));
  const defaults: ProfileDefaults | null = profile.data;
  return { categories: categoryOptions, catalog: catalogItems, defaults, timezone: profile.data?.timezone ?? "Europe/Budapest" };
}

const REMINDER_COLUMNS =
  "name, amount, currency, category_id, service_slug, is_subscription, recur_unit, recur_every, start_date, month_end, end_date, trial_ends_on, remind_enabled, remind_offsets, remind_time, channels, auto_paid, note, url, usage_tags";

export async function getReminderForEdit(id: string): Promise<ReminderRecord | null> {
  const { data } = await (await client()).from("reminders").select(REMINDER_COLUMNS).eq("id", id).maybeSingle();
  return data;
}
