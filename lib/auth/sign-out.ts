"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { REMEMBER_COOKIE } from "@/lib/auth/persist";
import { createClient } from "@/utils/supabase/server";

// Kijelentkezés. `scope=global`: minden eszközről (Profil → Biztonság). A push-feliratkozás marad (§10.3).
export async function signOut(formData: FormData): Promise<never> {
  const scope = formData.get("scope") === "global" ? "global" : "local";
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  await supabase.auth.signOut({ scope });
  cookieStore.delete(REMEMBER_COOKIE);
  redirect("/login");
}
