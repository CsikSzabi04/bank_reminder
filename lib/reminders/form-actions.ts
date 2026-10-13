"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { validationFailure } from "@/lib/auth/server-utils";
import { todayIn } from "@/lib/format";
import { readReminderForm, reminderSchema, toRecurrence, RECUR_UNITS, RECURRENCE_MODES } from "@/lib/schemas/reminder";
import { createClient } from "@/utils/supabase/server";
import { mapDbError } from "./db-error";

const id = z.uuid();

// Létrehozás / szerkesztés. Az identitást az RLS + `user_id default auth.uid()` adja (a kliens nem küld user_id-t);
// az esedékességeket és az értesítési sort az A-oldali trigger építi újra.
export async function saveReminder(
  reminderId: string | null,
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  if (reminderId !== null && !id.safeParse(reminderId).success) return { ok: false, code: "validation" };

  const parsed = reminderSchema.safeParse(readReminderForm(formData));
  if (!parsed.success) return validationFailure(parsed.error);
  const v = parsed.data;

  const supabase = createClient(await cookies());
  const { data: auth } = await supabase.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (!uid) return { ok: false, code: "unauthenticated" };

  // "Ma" a profil időzónájában (nem a böngészőében): új emlékeztető első esedékessége nem lehet múltbeli (§14.6)
  if (reminderId === null) {
    const { data: profile } = await supabase.from("profiles").select("timezone").eq("id", uid).single();
    if (profile && v.startDate < todayIn(profile.timezone)) {
      return { ok: false, code: "validation", fieldErrors: { startDate: ["startInPast"] } };
    }
  }

  const { recur_unit, recur_every } = toRecurrence(v);
  const row = {
    name: v.name,
    amount: v.amount,
    currency: v.currency,
    category_id: v.categoryId ?? null,
    service_slug: v.serviceSlug ?? null,
    is_subscription: v.isSubscription,
    recur_unit,
    recur_every,
    start_date: v.startDate,
    // a "hónap utolsó napja" csak havi ismétlődésnél értelmes
    month_end: v.recurrence === "month" && v.monthEnd,
    end_date: v.endDate ?? null,
    trial_ends_on: v.trialEndsOn ?? null,
    remind_enabled: v.remindEnabled,
    remind_offsets: [...new Set(v.offsets)].sort((a, b) => a - b),
    remind_time: v.remindTime,
    channels: [...(v.channelPush ? ["push"] : []), ...(v.channelEmail ? ["email"] : [])],
    auto_paid: v.autoPaid,
    note: v.note ?? null,
    url: v.url ?? null,
    usage_tags: v.usageTags,
  };

  const query = reminderId
    ? supabase.from("reminders").update(row).eq("id", reminderId)
    : supabase.from("reminders").insert(row);
  const { data, error } = await query.select("id").single();
  if (error) return mapDbError(error);

  // A tippek az új/módosított emlékeztető alapján frissülnek (A-21); a hibája nem akadályozza a mentést
  await supabase.rpc("refresh_tips");

  revalidatePath("/reminders");
  revalidatePath("/dashboard");
  // az onboarding 2. lépéséből indult új emlékeztető után a 3. lépés jön (csak ez az egy fix cél engedett)
  if (reminderId === null && formData.get("onboarding") === "1") redirect("/onboarding?step=3");
  redirect(`/reminders/${data.id}`);
}

const previewSchema = z.object({
  recurrence: z.enum(RECURRENCE_MODES),
  every: z.number().int().min(1).max(60),
  unit: z.enum(RECUR_UNITS).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  monthEnd: z.boolean(),
});

export type PreviewInput = z.input<typeof previewSchema>;
export type PreviewResult = { ok: true; dates: string[] } | { ok: false };

// Az űrlap „Következő: nov. 10., dec. 10., …" előnézete. A szabályt (hónap-vég, szökőév…) az A-oldali
// preview_dates adja — a kliens nem számol saját dátum-logikával.
export async function previewDates(input: PreviewInput): Promise<PreviewResult> {
  const parsed = previewSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const v = parsed.data;
  if (v.recurrence === "once") return { ok: true, dates: [v.startDate] };

  const { recur_unit, recur_every } = toRecurrence({ recurrence: v.recurrence, recurEvery: v.every, recurUnit: v.unit });
  const supabase = createClient(await cookies());
  const { data, error } = await supabase.rpc("preview_dates", {
    p_unit: recur_unit ?? "month",
    p_every: recur_every,
    p_start: v.startDate,
    p_month_end: v.recurrence === "month" && v.monthEnd,
    p_count: 24,
  });
  return error ? { ok: false } : { ok: true, dates: data ?? [] };
}
