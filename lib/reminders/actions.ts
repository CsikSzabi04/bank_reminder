"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { todayIn } from "@/lib/format";
import { addDays, zonedTimeToUtc } from "@/lib/tz";
import { createClient } from "@/utils/supabase/server";
import { mapDbError } from "./db-error";

const id = z.uuid();
const bad: ActionState = { ok: false, code: "validation" };

// Az identitást a DB-oldali RPC-k/RLS a JWT-ből veszik (auth.uid()); a kliens által küldött azonosító csak
// a célsor kiválasztására szolgál, és minden hozzáférést az RLS szűr saját sorra.
const db = async () => createClient(await cookies());

// Egy esedékesség változása a listát, a dashboardot és a részletoldalt is érinti
function refresh(reminderId?: string | null) {
  revalidatePath("/reminders");
  revalidatePath("/dashboard");
  if (reminderId) revalidatePath(`/reminders/${reminderId}`);
}

export async function markPaid(occurrenceId: string): Promise<ActionState> {
  if (!id.safeParse(occurrenceId).success) return bad;
  const { data, error } = await (await db()).rpc("mark_paid", { p_occurrence_id: occurrenceId });
  if (error) return mapDbError(error);
  refresh(data?.reminder_id);
  return { ok: true };
}

export async function markUnpaid(occurrenceId: string): Promise<ActionState> {
  if (!id.safeParse(occurrenceId).success) return bad;
  const { data, error } = await (await db()).rpc("mark_unpaid", { p_occurrence_id: occurrenceId });
  if (error) return mapDbError(error);
  refresh(data?.reminder_id);
  return { ok: true };
}

export async function skipOccurrence(occurrenceId: string): Promise<ActionState> {
  if (!id.safeParse(occurrenceId).success) return bad;
  const { data, error } = await (await db()).rpc("skip_occurrence", { p_occurrence_id: occurrenceId });
  if (error) return mapDbError(error);
  refresh(data?.reminder_id);
  return { ok: true };
}

const SNOOZE_DAYS = [1, 3, 7] as const;

// Halasztás: az új értesítés a megadott nap(ok) múlva, az emlékeztető saját időpontjában (a profil időzónájában)
export async function snoozeOccurrence(occurrenceId: string, days: number): Promise<ActionState> {
  if (!id.safeParse(occurrenceId).success || !(SNOOZE_DAYS as readonly number[]).includes(days)) return bad;
  const supabase = await db();

  let until: string | undefined; // üres = holnap a remind_time-kor (a DB alapértelmezése)
  if (days > 1) {
    const { data: auth } = await supabase.auth.getClaims();
    const uid = auth?.claims?.sub;
    if (!uid) return { ok: false, code: "unauthenticated" };
    const [{ data: occ }, { data: profile }] = await Promise.all([
      supabase.from("occurrences").select("reminders(remind_time)").eq("id", occurrenceId).single(),
      supabase.from("profiles").select("timezone").eq("id", uid).single(),
    ]);
    if (!occ || !profile) return { ok: false, code: "not_found" };
    const reminder = Array.isArray(occ.reminders) ? occ.reminders[0] : occ.reminders;
    const time = (reminder?.remind_time ?? "09:00").slice(0, 5);
    until = zonedTimeToUtc(addDays(todayIn(profile.timezone), days), time, profile.timezone).toISOString();
  }

  const { data, error } = await supabase.rpc("snooze_occurrence", { p_occurrence_id: occurrenceId, p_until: until });
  if (error) return mapDbError(error);
  refresh(data?.reminder_id);
  return { ok: true };
}

// Emlékeztetőnkénti értesítés-kapcsoló (🔔): a küldő a küldés pillanatában is ellenőrzi (§12.2/4)
export async function toggleReminderNotify(reminderId: string, enabled: boolean): Promise<ActionState> {
  if (!id.safeParse(reminderId).success || typeof enabled !== "boolean") return bad;
  const { error } = await (await db()).from("reminders").update({ remind_enabled: enabled }).eq("id", reminderId);
  if (error) return mapDbError(error);
  refresh(reminderId);
  return { ok: true };
}

export async function setReminderActive(reminderId: string, active: boolean): Promise<ActionState> {
  if (!id.safeParse(reminderId).success || typeof active !== "boolean") return bad;
  const { error } = await (await db()).from("reminders").update({ is_active: active }).eq("id", reminderId);
  if (error) return mapDbError(error);
  refresh(reminderId);
  return { ok: true };
}

export async function deleteReminder(reminderId: string): Promise<ActionState> {
  if (!id.safeParse(reminderId).success) return bad;
  const { error } = await (await db()).from("reminders").delete().eq("id", reminderId);
  if (error) return mapDbError(error);
  refresh();
  return { ok: true };
}

// Minta-adatok a SAJÁT fiókba (A-30): onboarding és kipróbálás; a sorok `is_demo` jelölést kapnak
export async function loadDemoData(): Promise<ActionState<{ count: number }>> {
  const { data, error } = await (await db()).rpc("load_demo_data");
  if (error) return mapDbError(error);
  refresh();
  return { ok: true, data: { count: data ?? 0 } };
}

export async function clearDemoData(): Promise<ActionState<{ count: number }>> {
  const { data, error } = await (await db()).rpc("clear_demo_data");
  if (error) return mapDbError(error);
  refresh();
  return { ok: true, data: { count: data ?? 0 } };
}
