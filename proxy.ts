import type { NextRequest } from "next/server";
import { buildCsp, generateNonce } from "@/lib/security/csp";
import { updateSession } from "@/utils/supabase/middleware";

export async function proxy(request: NextRequest) {
  // A nonce a kérés fejlécében is megy: a Next ebből látja, mely scripteket kell nonce-szal ellátnia,
  // a layout az `x-nonce`-ból adja tovább a téma-scriptnek.
  const nonce = generateNonce();
  const csp = buildCsp({
    nonce,
    isDev: process.env.NODE_ENV !== "production",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  });
  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", csp);

  const response = await updateSession(request);
  // az API JSON-t ad, ott a CSP-nek nincs szerepe
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    response.headers.set("Content-Security-Policy", csp);
  }
  return response;
}

// A statikus fájlok és az SW/manifest/ikonok kimaradnak (a sw.js-nek nem kell session)
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
