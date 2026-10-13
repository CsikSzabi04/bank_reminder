"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { validationFailure } from "@/lib/auth/server-utils";
import { displayNameSchema, isTheme } from "@/lib/schemas/profile";
import { createClient } from "@/utils/supabase/server";

// A téma mentése a profilba (§19.3). Kijelentkezve (login oldal) csendben nem csinál semmit.
export async function saveTheme(theme: string): Promise<ActionState> {
  if (!isTheme(theme)) return { ok: false, code: "validation" };
  const supabase = createClient(await cookies());
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  if (!uid) return { ok: false, code: "unauthenticated" };
  const { error } = await supabase.from("profiles").update({ theme }).eq("id", uid);
  return error ? { ok: false, code: "upstream_failed" } : { ok: true };
}

export async function updateDisplayName(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const parsed = displayNameSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = createClient(await cookies());
  // az identitás a szerveren ellenőrzött session-ből jön, nem a kliens által küldött mezőből
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  if (!uid) return { ok: false, code: "unauthenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.displayName })
    .eq("id", uid);
  if (error) return { ok: false, code: "upstream_failed" };

  revalidatePath("/profile");
  return { ok: true };
}
