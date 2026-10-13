import { describe, expect, it } from "vitest";
import { buildCsp, generateNonce } from "@/lib/security/csp";
import { SECURITY_HEADERS, SERVICE_WORKER_HEADERS } from "@/lib/security/headers";

const SUPABASE = "https://ddvzslgwexvdolovqqlg.supabase.co";
const prod = (nonce = "abc") => buildCsp({ nonce, isDev: false, supabaseUrl: SUPABASE });
const dev = (nonce = "abc") => buildCsp({ nonce, isDev: true, supabaseUrl: SUPABASE });
const directive = (csp: string, name: string) =>
  csp.split("; ").find((d) => d.startsWith(`${name} `) || d === name);

describe("buildCsp (§9.6)", () => {
  it("a script csak nonce-szal fut, 'unsafe-inline' és 'unsafe-eval' nincs élesben", () => {
    const script = directive(prod("N0NCE"), "script-src")!;
    expect(script).toContain("'nonce-N0NCE'");
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain("unsafe-inline");
    expect(script).not.toContain("unsafe-eval");
  });

  it("fejlesztői módban kell az unsafe-eval és a HMR websocket, élesben nem", () => {
    expect(directive(dev(), "script-src")).toContain("'unsafe-eval'");
    expect(directive(dev(), "connect-src")).toContain("ws://localhost:*");
    expect(directive(prod(), "connect-src")).not.toContain("localhost");
  });

  it("clickjacking / beágyazás / plugin / base-uri ellen zárva", () => {
    const csp = prod();
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(csp, "object-src")).toBe("object-src 'none'");
    expect(directive(csp, "base-uri")).toBe("base-uri 'self'");
    expect(directive(csp, "form-action")).toBe("form-action 'self'");
  });

  it("hálózat: csak saját origin és a mi Supabase projektünk; a képek https-ről jöhetnek (hírek, avatar)", () => {
    const connect = directive(prod(), "connect-src")!;
    expect(connect).toContain(SUPABASE);
    expect(connect).not.toContain("*.supabase.co");
    expect(directive(prod(), "img-src")).toContain("https:");
  });

  it("élesben upgrade-insecure-requests, fejlesztőiben nincs (http://localhost)", () => {
    expect(prod()).toContain("upgrade-insecure-requests");
    expect(dev()).not.toContain("upgrade-insecure-requests");
  });

  it("a nonce kérésenként egyedi és kellően hosszú", () => {
    const nonces = new Set(Array.from({ length: 50 }, generateNonce));
    expect(nonces.size).toBe(50);
    for (const n of nonces) expect(n.length).toBeGreaterThanOrEqual(32);
  });
});

describe("statikus biztonsági fejlécek", () => {
  const byKey = Object.fromEntries(SECURITY_HEADERS.map((h) => [h.key, h.value]));
  it("a §9.6 minden fejléce megvan", () => {
    expect(byKey["Strict-Transport-Security"]).toMatch(/max-age=\d{7,}/);
    expect(byKey["X-Content-Type-Options"]).toBe("nosniff");
    expect(byKey["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(byKey["Permissions-Policy"]).toContain("geolocation=()");
    expect(byKey["X-Frame-Options"]).toBe("DENY");
  });
  it("a sw.js nem cache-elhető és a teljes scope-ot kezelheti", () => {
    const sw = Object.fromEntries(SERVICE_WORKER_HEADERS.map((h) => [h.key, h.value]));
    expect(sw["Cache-Control"]).toContain("no-store");
    expect(sw["Service-Worker-Allowed"]).toBe("/");
  });
});
