import type { BankErrorCode } from "./types";

// A bank-átirányítás paraméterei (A-40, DECISIONS): siker → `?state=…&code=…`, hiba → `?state=…&error=…`.
export type CallbackParams =
  | { kind: "ok"; code: string; state: string }
  | { kind: "error"; reason: BankErrorCode };

// Az Enable code/state értékei UUID-szerűek; szigorúan szűrünk, hogy se napló, se átirányítás ne kapjon furcsa tartalmat
const TOKEN = /^[A-Za-z0-9._~-]{8,256}$/;

const one = (value: string | string[] | null | undefined) => (Array.isArray(value) ? value[0] : value) ?? undefined;

// A bank hibakódjai közül a felhasználó döntése (megtagadta) külön üzenet; a többi „a bank hibázott"
const DENIED = new Set(["access_denied", "user_cancelled", "cancelled", "consent_denied"]);

export function parseCallbackParams(search: URLSearchParams | Record<string, string | string[] | undefined>): CallbackParams {
  const get = (name: string) => (search instanceof URLSearchParams ? (search.get(name) ?? undefined) : one(search[name]));
  const error = get("error");
  if (error) return { kind: "error", reason: DENIED.has(error.toLowerCase()) ? "bank_denied" : "bank_error" };
  const code = get("code");
  const state = get("state");
  if (!code || !state || !TOKEN.test(code) || !TOKEN.test(state)) return { kind: "error", reason: "invalid_callback" };
  return { kind: "ok", code, state };
}

// A /bank oldal egyszeri visszajelzése az URL-ben: `?result=connected` vagy `?result=error&reason=…`.
// Csak ismert értékek jelennek meg (a paraméter nem jut a felületre nyersen).
export type BankFlash = { kind: "connected" } | { kind: "error"; reason: BankErrorCode };

export function bankFlashUrl(flash: BankFlash): string {
  const q = new URLSearchParams({ section: "overview", result: flash.kind });
  if (flash.kind === "error") q.set("reason", flash.reason);
  return `/bank?${q.toString()}`;
}
