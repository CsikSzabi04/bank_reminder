"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { mapAuthError } from "@/lib/auth/errors";
import { validationFailure } from "@/lib/auth/server-utils";
import { updatePasswordSchema } from "@/lib/schemas/auth";
import { createClient } from "@/utils/supabase/server";

export async function updatePassword(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updatePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = createClient(await cookies());
  // Az identitást a szerver ellenőrzi (nem a kliens állítja): érvényes (recovery) session kell
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, code: "unauthenticated", reason: "linkExpired" };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return mapAuthError(error);

  if (parsed.data.signOutOthers) await supabase.auth.signOut({ scope: "others" });
  redirect("/dashboard");
}
