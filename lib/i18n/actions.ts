"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_OPTIONS } from "./config";

// Nyelvváltás: süti mindig; belépve a profilba is mentjük, hogy az értesítések az új nyelven menjenek (§12.3, §19.3)
export async function setLocale(locale: string): Promise<{ ok: boolean }> {
  if (!isLocale(locale)) return { ok: false };
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, LOCALE_COOKIE_OPTIONS);

  const supabase = createClient(cookieStore);
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  if (uid) await supabase.from("profiles").update({ locale }).eq("id", uid);
  return { ok: true };
}
