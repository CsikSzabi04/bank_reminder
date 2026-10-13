import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";
import { NextResponse, type NextRequest } from "next/server";
import { applyPersistence, REMEMBER_COOKIE } from "@/lib/auth/persist";
import { getSupabaseEnv } from "./env";

// Session-frissítés a proxy.ts-nek. A védett útvonalak logikája a B-04 feladat.
// A createServerClient és a getClaims() közé nem szabad más kódot tenni (session-szinkron).
export async function updateSession(request: NextRequest) {
  const { url, key } = getSupabaseEnv();
  const remember = request.cookies.get(REMEMBER_COOKIE)?.value !== "0";
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, applyPersistence(options, remember)),
        );
        // session-sütit tartalmazó válasz nem kerülhet CDN-cache-be
        Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  return { response, claims: data?.claims ?? null };
}
