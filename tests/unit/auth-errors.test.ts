import { afterEach, describe, expect, it, vi } from "vitest";
import { mapAuthError } from "@/lib/auth/errors";

afterEach(() => vi.restoreAllMocks());

describe("mapAuthError (§10.8)", () => {
  const table = [
    ["invalid_credentials", "unauthenticated", "invalidCredentials"],
    ["email_not_confirmed", "forbidden", "emailNotConfirmed"],
    ["weak_password", "validation", "weakPassword"],
    ["over_email_send_rate_limit", "rate_limited", "tooManyEmails"],
    ["over_request_rate_limit", "rate_limited", "tooManyRequests"],
    ["otp_expired", "validation", "linkExpired"],
    ["bad_otp", "validation", "linkExpired"],
    ["flow_state_expired", "validation", "linkExpired"],
    ["same_password", "validation", "samePassword"],
  ] as const;

  it.each(table)("%s → %s / %s", (supabaseCode, code, reason) => {
    expect(mapAuthError({ code: supabaseCode, status: 400 })).toEqual({ ok: false, code, reason });
  });

  it("ismeretlen hiba → általános üzenet, és csak a kód kerül a logba (nincs PII)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = mapAuthError({ code: "valami_uj", status: 400, message: "user@example.com hibás" } as never);
    expect(out).toEqual({ ok: false, code: "unknown", reason: "generic" });
    expect(JSON.stringify(spy.mock.calls)).not.toContain("example.com");
  });

  it("5xx → upstream_failed, hiányzó hiba is általános", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(mapAuthError({ status: 503 })).toMatchObject({ code: "upstream_failed", reason: "generic" });
    expect(mapAuthError(null)).toMatchObject({ code: "unknown", reason: "generic" });
  });

  it("a user_already_exists NEM kap külön üzenetet (nem áruljuk el a fiók létezését)", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(mapAuthError({ code: "user_already_exists", status: 422 })).toMatchObject({ reason: "generic" });
  });
});
