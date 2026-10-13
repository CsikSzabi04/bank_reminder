"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { mapAuthError } from "@/lib/auth/errors";
import { getOrigin, validationFailure } from "@/lib/auth/server-utils";
import { signUpSchema } from "@/lib/schemas/auth";
import { createClient } from "@/utils/supabase/server";

export async function signUp(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationFailure(parsed.error);
  const { email, password, displayName, locale } = parsed.data;

  const supabase = createClient(await cookies());
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // a profiles sort a DB trigger hozza létre ebből; az e-mail sablon is ezt használja
      data: { display_name: displayName, locale },
      emailRedirectTo: `${await getOrigin()}/auth/confirm?next=/onboarding`,
    },
  });
  // létező e-mailnél is UGYANAZ a folyamat: nem áruljuk el, hogy van-e már fiók
  if (error && error.code !== "user_already_exists") return mapAuthError(error);

  redirect(`/check-email?type=signup&e=${encodeURIComponent(email)}`);
}
