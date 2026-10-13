// Statikus biztonsági fejlécek (§9.6). A next.config.ts importálja (relatív útvonallal: ott nincs @ alias).
// A CSP nonce-os, ezért a proxy.ts állítja be kérésenként.
export const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // a profilkép-fotózás a natív <input capture>-t használja, ahhoz nem kell kamera-engedély
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()",
  },
  // régebbi böngészőknek a CSP frame-ancestors mellé
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
] as const;

// A service worker frissítései azonnal észlelhetők legyenek (§13.4, §23.2)
export const SERVICE_WORKER_HEADERS = [
  { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
  { key: "Service-Worker-Allowed", value: "/" },
] as const;
