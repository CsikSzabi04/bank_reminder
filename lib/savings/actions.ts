"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { validationFailure } from "@/lib/auth/server-utils";
import { todayIn } from "@/lib/format";
import { mapDbError } from "@/lib/reminders/db-error";
import { bankMatchPatch, checkBankMatch } from "@/lib/bank/match";
import { contributionSchema, goalSchema } from "@/lib/schemas/savings";
import { createClient } from "@/utils/supabase/server";

const id = z.uuid();
const bad: ActionState = { ok: false, code: "validation" };
const db = async () => createClient(await cookies());

function refresh(goalId?: string) {
  revalidatePath("/savings", "layout");
  if (goalId) revalidatePath(`/savings/${goalId}`);
}

async function profileOf(supabase: Awaited<ReturnType<typeof db>>) {
  const { data: auth } = await supabase.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (!uid) return null;
  const { data } = await supabase.from("profiles").select("base_currency, timezone").eq("id", uid).single();
  return data;
}

// Új / módosított cél. A pénznem a profil alap-pénzneme (szerkesztésnél nem változik); a határidő jövőbeli kell legyen.
export async function saveGoal(goalId: string | null, _prev: ActionState | null, formData: FormData): Promise<ActionState> {
  if (goalId !== null && !id.safeParse(goalId).success) return bad;
  const parsed = goalSchema.safeParse({
    name: formData.get("name"),
    target: formData.get("target"),
    targetDate: formData.get("targetDate"),
    icon: formData.get("icon"),
    colorSlot: formData.get("colorSlot"),
    // a hiányzó mező (pl. egy telepítés előtt betöltött régi űrlap) nem hiba: üresként kezeljük
    bankMatch: formData.get("bankMatch") ?? "",
  });
  if (!parsed.success) return validationFailure(parsed.error);
  const v = parsed.data;
  const match = checkBankMatch(v.bankMatch); // a séma már ellenőrizte; itt a normalizált érték kell
  if (v.target <= 0) return { ok: false, code: "validation", fieldErrors: { target: ["amountInvalid"] } };

  const supabase = await db();
  const profile = await profileOf(supabase);
  if (!profile) return { ok: false, code: "unauthenticated" };
  if (v.targetDate && v.targetDate <= todayIn(profile.timezone)) {
    return { ok: false, code: "validation", fieldErrors: { targetDate: ["startInPast"] } };
  }

  const row = { name: v.name, target_amount: v.target, target_date: v.targetDate ?? null, icon: v.icon, color_slot: v.colorSlot, ...bankMatchPatch(match.ok ? match.value : null, formData.get("bankMatchWas") === "1") };
  const query = goalId
    ? supabase.from("savings_goals").update(row).eq("id", goalId)
    : supabase.from("savings_goals").insert({ ...row, currency: profile.base_currency });
  const { data, error } = await query.select("id").single();
  if (error) return mapDbError(error);
  refresh(data.id);
  redirect(`/savings/${data.id}`);
}

export async function archiveGoal(goalId: string, archived: boolean): Promise<ActionState> {
  if (!id.safeParse(goalId).success) return bad;
  const { error } = await (await db()).from("savings_goals").update({ archived_at: archived ? new Date().toISOString() : null }).eq("id", goalId);
  if (error) return mapDbError(error);
  refresh(goalId);
  return { ok: true };
}

// Befizetés / kivét: a kivét nem lehet több az összegyűltnél (az összegyűltet az SQL-view adja)
export async function addContribution(goalId: string, _prev: ActionState | null, formData: FormData): Promise<ActionState> {
  if (!id.safeParse(goalId).success) return bad;
  const parsed = contributionSchema.safeParse({
    amount: formData.get("amount"),
    direction: formData.get("direction"),
    contributedOn: formData.get("contributedOn"),
    note: formData.get("note"),
  });
  if (!parsed.success) return validationFailure(parsed.error);
  const v = parsed.data;
  if (v.amount <= 0) return { ok: false, code: "validation", fieldErrors: { amount: ["amountInvalid"] } };

  const supabase = await db();
  const profile = await profileOf(supabase);
  if (!profile) return { ok: false, code: "unauthenticated" };
  if (v.contributedOn > todayIn(profile.timezone)) return { ok: false, code: "validation", fieldErrors: { contributedOn: ["invalidDate"] } };

  if (v.direction === "withdraw") {
    const { data: goal } = await supabase.from("savings_goals_progress").select("saved").eq("id", goalId).maybeSingle();
    if (!goal) return { ok: false, code: "not_found" };
    if (v.amount > (goal.saved ?? 0)) return { ok: false, code: "validation", fieldErrors: { amount: ["insufficient"] } };
  }

  const { error } = await supabase.from("goal_contributions").insert({
    goal_id: goalId,
    amount: v.direction === "withdraw" ? -v.amount : v.amount,
    contributed_on: v.contributedOn,
    note: v.note ?? null,
  });
  if (error) return mapDbError(error);
  refresh(goalId);
  return { ok: true };
}

export async function deleteContribution(contributionId: string): Promise<ActionState> {
  if (!id.safeParse(contributionId).success) return bad;
  const { error } = await (await db()).from("goal_contributions").delete().eq("id", contributionId);
  if (error) return mapDbError(error);
  refresh();
  return { ok: true };
}
