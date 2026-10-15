// Publikus útvonalak (§10.6). Minden más bejelentkezést kér.
// A /reset-password publikus a proxy szemében, de az oldal maga recovery-session-t követel.
const PUBLIC_PATHS = new Set([
  "/login",
  "/signup",
  "/check-email",
  "/forgot-password",
  "/reset-password",
  "/install",
  "/privacy",
  "/terms",
  "/goodbye",
  "/offline",
  "/offline.html",
  "/api/health",
]);
const PUBLIC_PREFIXES = ["/auth/", "/api/ics/"];
// Bejelentkezve ezekre nincs szükség: a Főoldalra visz
const GUEST_ONLY = new Set(["/login", "/signup"]);

export type AccessDecision =
  | { kind: "next" }
  | { kind: "redirect"; to: string }
  | { kind: "unauthorized" };

function normalize(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

export function isPublicPath(pathname: string, isDev: boolean): boolean {
  const path = normalize(pathname);
  // a fejlesztői játszótér élesben amúgy is 404 (app/dev/ui/layout.tsx)
  if (isDev && (path === "/dev" || path.startsWith("/dev/"))) return true;
  return PUBLIC_PATHS.has(path) || PUBLIC_PREFIXES.some((p) => path.startsWith(p));
}

export function decideAccess(input: {
  pathname: string;
  search: string;
  authed: boolean;
  isDev: boolean;
}): AccessDecision {
  const path = normalize(input.pathname);
  if (path === "/") {
    return { kind: "redirect", to: input.authed ? "/dashboard" : "/login" };
  }
  if (input.authed && GUEST_ONLY.has(path)) {
    return { kind: "redirect", to: "/dashboard" };
  }
  if (input.authed || isPublicPath(path, input.isDev)) return { kind: "next" };
  // API-n átirányítás helyett 401 JSON: a kliens/SW nem HTML-t vár (§10.6)
  if (path.startsWith("/api/")) return { kind: "unauthorized" };
  return {
    kind: "redirect",
    to: `/login?next=${encodeURIComponent(path + input.search)}`,
  };
}
