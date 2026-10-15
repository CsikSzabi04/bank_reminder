// Felhasználó által megadott külső hivatkozás (pl. az emlékeztető „Link" mezője) csak http/https lehet:
// `javascript:`, `data:`, `file:` és hasonló sémák soha nem kerülhetnek href-be. A visszaadott érték a normalizált URL
// (vagy `null`, ha nem biztonságos/érvénytelen) — a hívó az `<a>`-t `rel="noopener noreferrer"`-rel rendereli.
export const MAX_EXTERNAL_URL = 2000;

export function safeExternalUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw || raw.length > MAX_EXTERNAL_URL || /\s/.test(raw)) return null;
  try {
    const url = new URL(raw);
    // felhasználónév/jelszó az URL-ben: megtévesztésre alkalmas (https://bank.hu@evil.example) → nem engedjük
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

// Megjelenítéshez: csak a gazdagép (pl. „claude.ai") — a felhasználó lássa, hova visz a link
export function externalUrlHost(value: string | null | undefined): string | null {
  const safe = safeExternalUrl(value);
  return safe ? new URL(safe).hostname.replace(/^www\./, "") : null;
}
