// Nonce-alapú Content-Security-Policy (§9.6). A proxy.ts kérésenként új nonce-ot generál.

export function generateNonce(): string {
  return btoa(crypto.randomUUID());
}

export function buildCsp({
  nonce,
  isDev,
  supabaseUrl,
}: {
  nonce: string;
  isDev: boolean;
  supabaseUrl: string | undefined;
}): string {
  const supabaseHost = supabaseUrl ? new URL(supabaseUrl).host : null;
  const connect = [
    "'self'",
    ...(supabaseHost ? [`https://${supabaseHost}`, `wss://${supabaseHost}`] : []),
    // a fejlesztői szerver HMR websocketje
    ...(isDev ? ["ws://localhost:*", "http://localhost:*"] : []),
  ];

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // Fejlesztői módban a Next/Turbopack saját, nonce nélküli scripteket és stílusokat injektál, és a React eval-t
    // használ a hibakereséshez → ott lazább. A szigorú (nonce-os) változatot a production e2e ellenőrzi (security.spec.ts).
    "script-src": isDev
      ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"]
      : ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"],
    "style-src": isDev ? ["'self'", "'unsafe-inline'"] : ["'self'", `'nonce-${nonce}'`],
    // a komponensek inline style="" attribútumokat használnak (monogram, diagram, kivágó); a nonce ezekre nem alkalmazható
    "style-src-attr": ["'unsafe-inline'"],
    // https: a hírképek (kiadói CDN, §18.6) és a Supabase Storage profilképek miatt
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'"],
    "connect-src": connect,
    "worker-src": ["'self'"],
    "manifest-src": ["'self'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  const parts = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  if (!isDev) parts.push("upgrade-insecure-requests");
  return parts.join("; ");
}
