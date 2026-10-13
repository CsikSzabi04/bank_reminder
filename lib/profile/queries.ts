import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { createClient } from "@/utils/supabase/server";

export type CurrentProfile = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_path: string | null;
  theme: string;
  locale: string;
  timezone: string;
  base_currency: string;
  created_at: string;
};

// Kérésenként egyszer fut (React cache), és csak a ténylegesen olvasott oszlopokat kéri (H11).
// Az identitás a JWT-ből jön (getClaims: helyben ellenőrzött), az adatot az RLS saját sorra szűri.
export const getCurrentProfile = cache(async (): Promise<CurrentProfile | null> => {
  const supabase = createClient(await cookies());
  const { data: auth } = await supabase.auth.getClaims();
  const claims = auth?.claims;
  if (!claims?.sub) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_path, theme, locale, timezone, base_currency, created_at")
    .eq("id", claims.sub)
    .single();
  if (!data) return null;
  return { ...data, email: typeof claims.email === "string" ? claims.email : "" };
});
