import { NextResponse, type NextRequest } from "next/server";
import type { ActionState, ErrorCode } from "@/lib/action-state";

// Sütis (session) POST-végpontok CSRF-védelme: csak azonos Origin (§21.5)
export const sameOrigin = (request: NextRequest) => request.headers.get("origin") === request.nextUrl.origin;

const STATUS: Record<ErrorCode, number> = {
  validation: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  limit_reached: 409,
  upstream_failed: 502,
  unknown: 500,
};

// Az ActionState → JSON válasz a §21.6 alakban, a megfelelő HTTP-státusszal
export function respond(state: ActionState): NextResponse {
  const body = state.ok ? { ok: true } : { ok: false, code: state.code };
  return NextResponse.json(body, { status: state.ok ? 200 : STATUS[state.code], headers: { "Cache-Control": "no-store" } });
}
