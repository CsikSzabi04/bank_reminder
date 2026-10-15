"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { validationFailure } from "@/lib/auth/server-utils";
import { CATEGORY_ICONS } from "@/lib/category-icons";
import { mapDbError } from "@/lib/reminders/db-error";
import { amountField, CURRENCIES, emptyToUndefined } from "@/lib/schemas/reminder";
import { isValidTimeZone } from "@/lib/tz";
import { createClient } from "@/utils/supabase/server";

const id = z.uuid();
const db = async () => createClient(await cookies());

function refresh() {
  revalidatePath("/", "layout");
}

const financeSchema = z.object({
  currency: z.enum(CURRENCIES, "invalidCurrency"),
  timezone: z.string().trim().max(64).refine(isValidTimeZone, "invalid"),
  // opcionális; csak a tippekhez (§19.1), harmadik félnek nem adjuk át
  income: z.preprocess(emptyToUndefined, amountField.optional()),
});

// Alap-pénznem, időzóna, havi jövedelem (üres = nincs megadva)
export async function saveFinance(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const parsed = financeSchema.safeParse({ currency: formData.get("currency"), timezone: formData.get("timezone"), income: formData.get("income") });
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = await db();
  const { data: auth } = await supabase.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (!uid) return { ok: false, code: "unauthenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ base_currency: parsed.data.currency, timezone: parsed.data.timezone, monthly_income: parsed.data.income ?? null })
    .eq("id", uid);
  if (error) return mapDbError(error);
  refresh();
  return { ok: true };
}

const CATEGORY_COLOR_SLOTS = [1, 2, 3, 4, 5, 6, 7, 9] as const;
const optionalName = z.preprocess(emptyToUndefined, z.string().trim().max(40, "tooLong").optional());

const categorySchema = z
  .object({
    nameHu: optionalName,
    nameEn: optionalName,
    icon: z.string().refine((v) => v in CATEGORY_ICONS, "invalid"),
    colorSlot: z.coerce.number("invalid").refine((n) => (CATEGORY_COLOR_SLOTS as readonly number[]).includes(n), "invalid"),
    kind: z.enum(["bill", "expense", "both"], "invalid"),
  })
  // legalább az egyik nyelvű név kell (DB-megszorítás is)
  .refine((v) => v.nameHu || v.nameEn, { path: ["nameHu"], message: "required" });

// Saját kategória létrehozása / módosítása (rendszer-kategóriát az RLS nem enged módosítani)
export async function saveCategory(categoryId: string | null, _prev: ActionState | null, formData: FormData): Promise<ActionState> {
  if (categoryId !== null && !id.safeParse(categoryId).success) return { ok: false, code: "validation" };
  const parsed = categorySchema.safeParse({
    nameHu: formData.get("nameHu"),
    nameEn: formData.get("nameEn"),
    icon: formData.get("icon"),
    colorSlot: formData.get("colorSlot"),
    kind: formData.get("kind"),
  });
  if (!parsed.success) return validationFailure(parsed.error);

  const row = { name_hu: parsed.data.nameHu ?? null, name_en: parsed.data.nameEn ?? null, icon: parsed.data.icon, color_slot: parsed.data.colorSlot, kind: parsed.data.kind };
  const supabase = await db();
  const { data: auth } = await supabase.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (!uid) return { ok: false, code: "unauthenticated" };
  // a categories.user_id-nak nincs DB-alapértéke: az identitást a szerveren ellenőrzött session adja (az RLS is erre ellenőriz)
  const { error } = categoryId
    ? await supabase.from("categories").update(row).eq("id", categoryId)
    : await supabase.from("categories").insert({ ...row, user_id: uid });
  if (error) return mapDbError(error);
  refresh();
  return { ok: true };
}

// A hozzá tartozó keret törlődik, az emlékeztetők/kiadások „kategória nélkül" maradnak (FK: on delete)
export async function deleteCategory(categoryId: string): Promise<ActionState> {
  if (!id.safeParse(categoryId).success) return { ok: false, code: "validation" };
  const { error } = await (await db()).from("categories").delete().eq("id", categoryId);
  if (error) return mapDbError(error);
  refresh();
  return { ok: true };
}
