import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { bankFlashUrl, parseCallbackParams, type BankFlash } from "@/lib/bank/callback";
import { finishConnectionCore } from "@/lib/bank/service";
import { createClient } from "@/utils/supabase/server";

// A bank-átirányítás célja (advanced.md §5.4, §10.7): az Enable-ben pontosan ez az útvonal van regisztrálva (nem /api/…).
// A bank `?state=…&code=…` (hibánál `?state=…&error=…`) paraméterekkel hozza vissza a felhasználót.
// Védelem: a `state` a szerveren a bejelentkezett felhasználóhoz kötött, 10 perces, egyszer használatos (az Edge Function ellenőrzi);
// itt csak a session-t és a paraméterek alakját nézzük. A `code`/`state` nem kerül logba, és az átirányítás után nincs az URL-ben.
const PRIVATE_HEADERS = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } as const;

function back(request: NextRequest, flash: BankFlash): NextResponse {
  const response = NextResponse.redirect(new URL(bankFlashUrl(flash), request.url));
  for (const [name, value] of Object.entries(PRIVATE_HEADERS)) response.headers.set(name, value);
  return response;
}

export async function GET(request: NextRequest) {
  const params = parseCallbackParams(request.nextUrl.searchParams);
  if (params.kind === "error") return back(request, { kind: "error", reason: params.reason });

  const supabase = createClient(await cookies());
  const { data: auth } = await supabase.auth.getClaims();
  // a proxy a kijelentkezettet már a belépéshez küldte; ez a védelem mélysége
  if (!auth?.claims?.sub) return back(request, { kind: "error", reason: "unauthenticated" });

  const result = await finishConnectionCore(supabase, { code: params.code, state: params.state });
  return back(request, result.ok ? { kind: "connected" } : { kind: "error", reason: result.code });
}
