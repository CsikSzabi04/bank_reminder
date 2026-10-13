import { createServerClient } from "@supabase/ssr";
import type { cookies } from "next/headers";
import { applyPersistence, REMEMBER_COOKIE } from "@/lib/auth/persist";
import { getSupabaseEnv } from "./env";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

// Szerver-oldali kliens (RSC, Server Action, route handler). Titok nincs benne: csak a publishable key.
export function createClient(
  cookieStore: CookieStore,
  opts: { remember?: boolean } = {},
) {
  const { url, key } = getSupabaseEnv();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        const remember =
          opts.remember ?? cookieStore.get(REMEMBER_COOKIE)?.value !== "0";
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, applyPersistence(options, remember)),
          );
        } catch {
          // Server Componentből hívva nem írhatunk sütit: a proxy.ts frissíti a sessiont
        }
      },
    },
  });
}
