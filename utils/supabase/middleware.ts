import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";
import { NextResponse, type NextRequest } from "next/server";
import { applyPersistence, REMEMBER_COOKIE } from "@/lib/auth/persist";
import { decideAccess } from "@/lib/auth/routes";
import { getSupabaseEnv } from "./env";

const NO_STORE = "private, no-store";

// Átirányításnál/401-nél a frissített session-sütiket át kell vinni az új válaszra
function carryCookies(from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  to.headers.set("Cache-Control", NO_STORE);
  return to;
}

// Session-frissítés + útvonal-védelem a proxy.ts-nek (§10.6).
// A createServerClient és a getClaims() közé nem szabad más kódot tenni (session-szinkron).
export async function updateSession(request: NextRequest): Promise<NextResponse> {
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
  const authed = Boolean(data?.claims);

  const decision = decideAccess({
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    authed,
    isDev: process.env.NODE_ENV !== "production",
  });

  if (decision.kind === "redirect") {
    return carryCookies(response, NextResponse.redirect(new URL(decision.to, request.url)));
  }
  if (decision.kind === "unauthorized") {
    return carryCookies(
      response,
      NextResponse.json({ ok: false, code: "unauthenticated" }, { status: 401 }),
    );
  }

  // hitelesített válasz sosem cache-elhető (§10.6/6)
  if (authed) response.headers.set("Cache-Control", NO_STORE);
  // a response objektumot módosítatlanul adjuk vissza: a sütik rajta vannak
  return response;
}
