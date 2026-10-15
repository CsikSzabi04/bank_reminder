"use server";

import { cookies } from "next/headers";
import type { ActionState } from "@/lib/action-state";
import { mapAuthError } from "@/lib/auth/errors";
import { getOrigin, validationFailure } from "@/lib/auth/server-utils";
import { emailOnlySchema, updatePasswordSchema } from "@/lib/schemas/auth";
import { createClient } from "@/utils/supabase/server";

// Jelszó módosítása a profilból. Az identitást a szerver ellenőrzi; ha a session túl régi, a Supabase
// `reauthentication_needed`-et ad → a UI új bejelentkezést kér (§19.1).
export async function changePassword(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const parsed = updatePasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = createClient(await cookies());
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, code: "unauthenticated" };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return mapAuthError(error);
  if (parsed.data.signOutOthers) await supabase.auth.signOut({ scope: "others" });
  return { ok: true };
}

// E-mail módosítása: a Supabase megerősítő levelet küld az ÚJ címre; amíg nem erősít, a régi marad érvényben.
// A foglalt címet nem árulja el külön (az `email_exists` is általános hibára képződik).
export async function changeEmail(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const parsed = emailOnlySchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return validationFailure(parsed.error);

  const supabase = createClient(await cookies());
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, code: "unauthenticated" };
  if (data.user.email?.toLowerCase() === parsed.data.email.toLowerCase()) {
    return { ok: false, code: "validation", fieldErrors: { email: ["sameEmail"] } };
  }

  const { error } = await supabase.auth.updateUser(
    { email: parsed.data.email },
    { emailRedirectTo: `${await getOrigin()}/auth/confirm?next=${encodeURIComponent("/profile?section=security")}` },
  );
  if (error) return mapAuthError(error);
  return { ok: true };
}
