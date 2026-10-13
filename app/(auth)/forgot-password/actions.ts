"use server";

import { cookies } from "next/headers";
import type { ActionState } from "@/lib/action-state";
import { mapAuthError } from "@/lib/auth/errors";
import { validationFailure } from "@/lib/auth/server-utils";
import { emailOnlySchema } from "@/lib/schemas/auth";
import { createClient } from "@/utils/supabase/server";

// Mindig ugyanaz a „ha létezik ilyen fiók…" válasz: a fiók létezése nem derül ki (§10.4)
export async function requestPasswordReset(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const parsed = emailOnlySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = createClient(await cookies());
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email);
  if (error) return mapAuthError(error);
  return { ok: true };
}
