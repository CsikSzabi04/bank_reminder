import type { ActionState, ErrorCode } from "@/lib/action-state";

type Failure = Extract<ActionState, { ok: false }>;

// Az A-oldali RPC-k SQLSTATE-kódjai → a közös ErrorCode (CONTRACT_CHANGES: 28000/P0002/22023/53400/23514)
const MAP: Record<string, ErrorCode> = {
  "28000": "unauthenticated",
  "42501": "forbidden", // RLS-sértés
  P0002: "not_found",
  "22023": "validation",
  "23514": "validation", // check-megszorítás (pl. tiltott push-host)
  "23503": "validation", // hivatkozott sor (kategória/katalógus) nem létezik
  "23505": "conflict",
  "53400": "limit_reached",
};

export function mapDbError(error: { code?: string } | null | undefined): Failure {
  const code = error?.code ? MAP[error.code] : undefined;
  if (!code) {
    // csak a kód kerül a naplóba (nincs PII)
    console.error("db error", { code: error?.code ?? "none" });
    return { ok: false, code: "unknown" };
  }
  return { ok: false, code };
}
