import type { ActionState } from "@/lib/action-state";

export type AuthErrorReason =
  | "invalidCredentials"
  | "emailNotConfirmed"
  | "weakPassword"
  | "tooManyEmails"
  | "tooManyRequests"
  | "linkExpired"
  | "samePassword"
  | "reauthNeeded"
  | "generic";

type Failure = Extract<ActionState, { ok: false }>;

// Supabase-hibakód → UI-üzenet (§10.8). Egy helyen él, hogy az üzenetek általánosak maradjanak
// (nem árulunk el, hogy létezik-e a fiók).
export function mapAuthError(error: { code?: string; status?: number } | null | undefined): Failure {
  const code = error?.code;
  const fail = (c: Failure["code"], reason: AuthErrorReason): Failure => ({ ok: false, code: c, reason });

  switch (code) {
    case "invalid_credentials":
      return fail("unauthenticated", "invalidCredentials");
    case "email_not_confirmed":
      return fail("forbidden", "emailNotConfirmed");
    case "weak_password":
      return fail("validation", "weakPassword");
    case "over_email_send_rate_limit":
      return fail("rate_limited", "tooManyEmails");
    case "over_request_rate_limit":
      return fail("rate_limited", "tooManyRequests");
    case "otp_expired":
    case "bad_otp":
    case "bad_code_verifier":
    case "flow_state_expired":
    case "flow_state_not_found":
      return fail("validation", "linkExpired");
    case "same_password":
      return fail("validation", "samePassword");
    // a jelszó/e-mail módosításához friss bejelentkezés kell (§19.1)
    case "reauthentication_needed":
    case "reauthentication_not_valid":
      return fail("forbidden", "reauthNeeded");
  }
  // Ismeretlen: csak a kódot naplózzuk, e-mailt/nevet soha (PII-mentes)
  console.error("auth error", { code: code ?? "none", status: error?.status ?? 0 });
  return fail((error?.status ?? 0) >= 500 ? "upstream_failed" : "unknown", "generic");
}
