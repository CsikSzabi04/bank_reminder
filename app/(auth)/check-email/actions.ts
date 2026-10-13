"use server";

import { cookies } from "next/headers";
import type { ActionState } from "@/lib/action-state";
import { mapAuthError } from "@/lib/auth/errors";
import { getOrigin, validationFailure } from "@/lib/auth/server-utils";
import { emailOnlySchema } from "@/lib/schemas/auth";
import { createClient } from "@/utils/supabase/server";

// Megerősítő levél újraküldése. A kliens 60 mp-es visszaszámlálást mutat; a szerver oldali korlát a Supabase-é.
export async function resendConfirmation(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const parsed = emailOnlySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = createClient(await cookies());
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo: `${await getOrigin()}/auth/confirm?next=/onboarding` },
  });
  if (error) return mapAuthError(error);
  return { ok: true };
}
