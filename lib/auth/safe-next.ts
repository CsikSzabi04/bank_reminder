// Open redirect ellen: csak az app saját, relatív útvonala fogadható el (§10.7)
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  try {
    const u = new URL(next, "http://x");
    return u.origin === "http://x" ? u.pathname + u.search : fallback;
  } catch {
    return fallback;
  }
}
