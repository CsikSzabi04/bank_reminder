"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { mapAuthError } from "@/lib/auth/errors";
import { FOUR_HUNDRED_DAYS, REMEMBER_COOKIE } from "@/lib/auth/persist";
import { safeNext } from "@/lib/auth/safe-next";
import { validationFailure } from "@/lib/auth/server-utils";
import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_OPTIONS } from "@/lib/i18n/config";
import { signInSchema } from "@/lib/schemas/auth";
import { createClient } from "@/utils/supabase/server";

export async function signIn(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationFailure(parsed.error);
  const { email, password, remember, next } = parsed.data;

  const cookieStore = await cookies();
  // A jelző a bejelentkezés ELŐTT kerül be, és a `remember`-t explicit adjuk át: nem támaszkodunk arra,
  // hogy a cookies().get azonnal látja a frissen írt értéket (§10.3). Nem httpOnly: a böngésző-kliens is olvassa.
  cookieStore.set(REMEMBER_COOKIE, remember ? "1" : "0", {
    path: "/",
    maxAge: FOUR_HUNDRED_DAYS,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  const supabase = createClient(cookieStore, { remember });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return mapAuthError(error);

  // Belépéskor a profil nyelve nyer az eszköz helyi beállítása felett (§20.1): a süti a profilból áll be
  const { data: profile } = await supabase.from("profiles").select("locale").eq("id", data.user.id).single();
  if (profile && isLocale(profile.locale)) cookieStore.set(LOCALE_COOKIE, profile.locale, LOCALE_COOKIE_OPTIONS);

  redirect(safeNext(next));
}
