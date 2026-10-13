"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { mapDbError } from "@/lib/reminders/db-error";
import { USAGE_TAGS } from "@/lib/schemas/reminder";
import { createClient } from "@/utils/supabase/server";

const id = z.uuid();
const bad: ActionState = { ok: false, code: "validation" };
const db = async () => createClient(await cookies());

function refresh() {
  revalidatePath("/tips");
  revalidatePath("/dashboard");
}

// seen | dismiss | snooze | done (A-21 `tip_action`); a státuszváltást a DB végzi
export async function tipAction(tipId: string, action: "seen" | "dismiss" | "snooze" | "done"): Promise<ActionState> {
  if (!id.safeParse(tipId).success || !["seen", "dismiss", "snooze", "done"].includes(action)) return bad;
  const { error } = await (await db()).rpc("tip_action", { p_tip_id: tipId, p_action: action });
  if (error) return mapDbError(error);
  if (action !== "seen") refresh();
  return { ok: true };
}

// „Mit nézel itt?": a használati címkék az emlékeztetőre kerülnek, a tippek újraszámolódnak (az `originals` kizárólagos jelölés a motorban)
export async function setUsageTags(reminderId: string, tags: string[]): Promise<ActionState> {
  if (!id.safeParse(reminderId).success) return bad;
  const clean = [...new Set(tags)].filter((t): t is (typeof USAGE_TAGS)[number] => (USAGE_TAGS as readonly string[]).includes(t));
  const supabase = await db();
  const { error } = await supabase.from("reminders").update({ usage_tags: clean }).eq("id", reminderId);
  if (error) return mapDbError(error);
  await supabase.rpc("refresh_tips");
  refresh();
  return { ok: true };
}

// „Használtad az elmúlt hónapban?" — 2× „nem" után a motor lemondási tippet ad
export async function answerUsage(reminderId: string, used: boolean): Promise<ActionState> {
  if (!id.safeParse(reminderId).success) return bad;
  const { error } = await (await db()).rpc("answer_usage_check", { p_reminder_id: reminderId, p_used: used });
  if (error) return mapDbError(error);
  refresh();
  return { ok: true };
}

// A tippek ki/bekapcsolása (profiles.tips_enabled)
export async function setTipsEnabled(enabled: boolean): Promise<ActionState> {
  const supabase = await db();
  const { data: auth } = await supabase.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (!uid) return { ok: false, code: "unauthenticated" };
  const { error } = await supabase.from("profiles").update({ tips_enabled: enabled }).eq("id", uid);
  if (error) return mapDbError(error);
  if (enabled) await supabase.rpc("refresh_tips");
  refresh();
  return { ok: true };
}
