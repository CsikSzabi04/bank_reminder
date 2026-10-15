"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { validationFailure } from "@/lib/auth/server-utils";
import { todayIn } from "@/lib/format";
import { mapDbError } from "@/lib/reminders/db-error";
import { budgetSchema, expenseSchema } from "@/lib/schemas/budget";
import { createClient } from "@/utils/supabase/server";

const id = z.uuid();
const bad: ActionState = { ok: false, code: "validation" };

// A kliens nem küld user_id-t (user_id default auth.uid()), minden sort az RLS szűr saját sorra.
const db = async () => createClient(await cookies());

function refresh() {
  revalidatePath("/budgets", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
}

async function profileOf(supabase: Awaited<ReturnType<typeof db>>) {
  const { data: auth } = await supabase.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (!uid) return null;
  const { data } = await supabase.from("profiles").select("base_currency, timezone").eq("id", uid).single();
  return data;
}

// Új / módosított keret: kategóriánként egy (unique user_id + category_id) → upsert. A keret az alap-pénznemben él.
export async function saveBudget(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const parsed = budgetSchema.safeParse({ categoryId: formData.get("categoryId"), limit: formData.get("limit") });
  if (!parsed.success) return validationFailure(parsed.error);
  if (parsed.data.limit <= 0) return { ok: false, code: "validation", fieldErrors: { limit: ["amountInvalid"] } };

  const supabase = await db();
  const profile = await profileOf(supabase);
  if (!profile) return { ok: false, code: "unauthenticated" };

  const { error } = await supabase
    .from("budgets")
    .upsert(
      { category_id: parsed.data.categoryId, monthly_limit: parsed.data.limit, currency: profile.base_currency },
      { onConflict: "user_id,category_id" },
    );
  if (error) return mapDbError(error);
  refresh();
  redirect("/budgets");
}

export async function deleteBudget(budgetId: string): Promise<ActionState> {
  if (!id.safeParse(budgetId).success) return bad;
  const { error } = await (await db()).from("budgets").delete().eq("id", budgetId);
  if (error) return mapDbError(error);
  refresh();
  return { ok: true };
}

// Gyors kiadás (F-12): a pénznem a profil alap-pénzneme; jövőbeli dátum nem rögzíthető
export async function addExpense(_prev: ActionState<{ id: string }> | null, formData: FormData): Promise<ActionState<{ id: string }>> {
  const parsed = expenseSchema.safeParse({
    amount: formData.get("amount"),
    categoryId: formData.get("categoryId"),
    spentOn: formData.get("spentOn"),
    note: formData.get("note"),
  });
  if (!parsed.success) return validationFailure(parsed.error);
  const v = parsed.data;
  if (v.amount <= 0) return { ok: false, code: "validation", fieldErrors: { amount: ["amountInvalid"] } };

  const supabase = await db();
  const profile = await profileOf(supabase);
  if (!profile) return { ok: false, code: "unauthenticated" };
  if (v.spentOn > todayIn(profile.timezone)) return { ok: false, code: "validation", fieldErrors: { spentOn: ["invalidDate"] } };

  const { data, error } = await supabase
    .from("expenses")
    .insert({ amount: v.amount, currency: profile.base_currency, category_id: v.categoryId ?? null, spent_on: v.spentOn, note: v.note ?? null })
    .select("id")
    .single();
  if (error) return mapDbError(error);
  refresh();
  return { ok: true, data: { id: data.id } };
}

// A törölt kiadás visszavonása: a tétel újra felvételre kerül ugyanazokkal az adatokkal. Az automatikusan felvett (értesítés/bank)
// tétel törlésekor a főkönyvi sor `dismissed` lett (ne éledjen újra) — a visszaállított tétel ezért kézi forrású marad,
// a `source`/`is_provisional` jelzőt a DB-őr kliensről nem engedi hamisítani.
const restoreSchema = z.object({
  amount: z.number().positive().max(999_999_999_999),
  currency: z.string().regex(/^[A-Z]{3}$/),
  spentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  categoryId: z.uuid().nullable(),
  note: z.string().max(200).nullable(),
  merchant: z.string().max(80).nullable(),
});
export type RestoreExpenseInput = z.infer<typeof restoreSchema>;

export async function restoreExpense(input: RestoreExpenseInput): Promise<ActionState<{ id: string }>> {
  const parsed = restoreSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "validation" };
  const v = parsed.data;
  const supabase = await db();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return { ok: false, code: "unauthenticated" };
  const { data, error } = await supabase
    .from("expenses")
    .insert({ amount: v.amount, currency: v.currency, spent_on: v.spentOn, category_id: v.categoryId, note: v.note, merchant: v.merchant })
    .select("id")
    .single();
  if (error) return mapDbError(error);
  refresh();
  return { ok: true, data: { id: data.id } };
}

export async function deleteExpense(expenseId: string): Promise<ActionState> {
  if (!id.safeParse(expenseId).success) return bad;
  const { error } = await (await db()).from("expenses").delete().eq("id", expenseId);
  if (error) return mapDbError(error);
  refresh();
  return { ok: true };
}
