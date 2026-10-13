import { createBrowserClient } from "@supabase/ssr";
import { FOUR_HUNDRED_DAYS, REMEMBER_COOKIE } from "@/lib/auth/persist";
import { getSupabaseEnv } from "./env";

function readRemember(): boolean {
  if (typeof document === "undefined") return true;
  return !document.cookie.split("; ").includes(`${REMEMBER_COOKIE}=0`);
}

// Böngésző-kliens: csak ott, ahol kell (auth-űrlap, feltöltés); egyébként RSC + Server Action
export function createClient() {
  const { url, key } = getSupabaseEnv();
  return createBrowserClient(url, key, {
    cookieOptions: {
      // undefined = session-süti ("Maradjak bejelentkezve" kikapcsolva)
      maxAge: readRemember() ? FOUR_HUNDRED_DAYS : undefined,
    },
  });
}
