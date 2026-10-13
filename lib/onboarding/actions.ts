"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { validationFailure } from "@/lib/auth/server-utils";
import { mapDbError } from "@/lib/reminders/db-error";
import { CURRENCIES } from "@/lib/schemas/reminder";
import { createClient } from "@/utils/supabase/server";

// Érvényes IANA időzóna? (az Intl dob, ha ismeretlen)
function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return /^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)*$/.test(tz);
  } catch {
    return false;
  }
}

const basicsSchema = z.object({
  currency: z.enum(CURRENCIES, "invalidCurrency"),
  timezone: z.string().trim().max(64).refine(isTimeZone, "invalid"),
});

// 1. lépés: alap-pénznem + az automatikusan felismert időzóna (a nyelv/téma a saját kapcsolójukkal már mentődött)
export async function saveBasics(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const parsed = basicsSchema.safeParse({ currency: formData.get("currency"), timezone: formData.get("timezone") });
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = createClient(await cookies());
  const { data: auth } = await supabase.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (!uid) return { ok: false, code: "unauthenticated" };
  const { error } = await supabase.from("profiles").update({ base_currency: parsed.data.currency, timezone: parsed.data.timezone }).eq("id", uid);
  if (error) return mapDbError(error);
  redirect("/onboarding?step=2");
}

// Kihagyás / befejezés: onboarding_done = true, Főoldal
export async function finishOnboarding(): Promise<void> {
  const supabase = createClient(await cookies());
  const { data: auth } = await supabase.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (uid) await supabase.from("profiles").update({ onboarding_done: true }).eq("id", uid);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
