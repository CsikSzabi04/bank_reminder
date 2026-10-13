import { describe, expect, it } from "vitest";
import { decideAccess, isPublicPath } from "@/lib/auth/routes";

const decide = (pathname: string, authed: boolean, search = "", isDev = false) =>
  decideAccess({ pathname, search, authed, isDev });

describe("decideAccess (§10.6)", () => {
  it("védett oldal kijelentkezve → /login?next=…", () => {
    expect(decide("/dashboard", false)).toEqual({ kind: "redirect", to: "/login?next=%2Fdashboard" });
    expect(decide("/reminders/abc", false, "?occ=1")).toEqual({
      kind: "redirect",
      to: "/login?next=%2Freminders%2Fabc%3Focc%3D1",
    });
  });

  it("védett /api/* kijelentkezve → 401, nem átirányítás", () => {
    expect(decide("/api/export", false)).toEqual({ kind: "unauthorized" });
    expect(decide("/api/occurrences/x/paid", false)).toEqual({ kind: "unauthorized" });
  });

  it("publikus útvonalak kijelentkezve átmennek", () => {
    for (const p of [
      "/login", "/signup", "/check-email", "/forgot-password", "/reset-password",
      "/auth/confirm", "/auth/callback", "/install", "/privacy", "/terms", "/offline",
      "/offline.html", "/api/health", "/api/ics/abc123.ics",
    ]) {
      expect(decide(p, false)).toEqual({ kind: "next" });
    }
  });

  it("kijelentkezve a gyökér /login-ra, belépve /dashboard-ra visz", () => {
    expect(decide("/", false)).toEqual({ kind: "redirect", to: "/login" });
    expect(decide("/", true)).toEqual({ kind: "redirect", to: "/dashboard" });
  });

  it("belépve a /login és /signup a Főoldalra visz, a többi átmegy", () => {
    expect(decide("/login", true)).toEqual({ kind: "redirect", to: "/dashboard" });
    expect(decide("/signup", true)).toEqual({ kind: "redirect", to: "/dashboard" });
    expect(decide("/reminders", true)).toEqual({ kind: "next" });
    expect(decide("/api/export", true)).toEqual({ kind: "next" });
  });

  it("záró perjel nem kerüli meg a védelmet, és nem teszi publikussá", () => {
    expect(decide("/dashboard/", false).kind).toBe("redirect");
    expect(decide("/login/", false)).toEqual({ kind: "next" });
  });

  it("hasonló nevű útvonal nem publikus (prefix-tévesztés)", () => {
    expect(isPublicPath("/loginx", false)).toBe(false);
    expect(isPublicPath("/authx/confirm", false)).toBe(false);
    expect(isPublicPath("/api/healthz", false)).toBe(false);
    expect(isPublicPath("/api/icsx/a", false)).toBe(false);
    expect(isPublicPath("/auth", false)).toBe(false);
  });

  it("/dev/* csak fejlesztői módban publikus", () => {
    expect(isPublicPath("/dev/ui", true)).toBe(true);
    expect(isPublicPath("/dev/ui", false)).toBe(false);
    expect(isPublicPath("/devx", true)).toBe(false);
  });
});
