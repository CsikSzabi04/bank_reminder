// Android értesítés-olvasás (MacroDroid/Tasker → webhook), B-oldali tiszta logika (advanced.md §5.1, §8.3). Nincs I/O → tesztelhető.

export type IngestToken = {
  id: string;
  prefix: string;
  label: string | null;
  allowedApps: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export const INGEST_OUTCOMES = ["recorded", "duplicate", "ignored", "unparsed", "rejected"] as const;
export type IngestOutcome = (typeof INGEST_OUTCOMES)[number];

export type IngestEvent = { id: number; app: string | null; outcome: IngestOutcome; at: string };

// A csomag-allowlist korlátai: egyeznek az `ingest_tokens` tábla CHECK-jével (≤ 20 elem, ≤ 2000 bájt)
export const MAX_ALLOWED_APPS = 20;
export const MAX_APPS_BYTES = 2000;
export const MAX_LABEL = 40;
// Ennyi idő után („nem jön semmi") hibaelhárító szöveg jelenik meg (advanced.md §8.3)
export const STALE_AFTER_MS = 24 * 3_600_000;

const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const date = (v: unknown): string | null => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : null);

// Android csomagnév: pontokkal tagolt, betűvel kezdődő szegmensek (pl. hu.otpbank.mobile)
const PACKAGE = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/;
export const isValidPackageName = (value: string): boolean => value.length <= 200 && PACKAGE.test(value);

export type AppsCheck = { ok: true; apps: string[] } | { ok: false; reason: "invalid" | "tooMany" | "tooLong" };

// A beírt csomagnevek tisztítása: levágott szóköz, egyediség (kis/nagybetű-érzékeny, mint az Android), érvényes alak, darab- és bájt-korlát
export function normalizeApps(input: string[]): AppsCheck {
  const apps: string[] = [];
  for (const raw of input) {
    const app = raw.trim();
    if (!app) continue;
    if (!isValidPackageName(app)) return { ok: false, reason: "invalid" };
    if (!apps.includes(app)) apps.push(app);
  }
  if (apps.length > MAX_ALLOWED_APPS) return { ok: false, reason: "tooMany" };
  if (new TextEncoder().encode(apps.join(",")).length > MAX_APPS_BYTES) return { ok: false, reason: "tooLong" };
  return { ok: true, apps };
}

export function parseIngestTokens(rows: unknown): IngestToken[] {
  if (!Array.isArray(rows)) return [];
  const out: IngestToken[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = str(r.id, 64);
    const prefix = str(r.prefix, 12);
    const createdAt = date(r.created_at);
    if (!id || !prefix || !createdAt) continue;
    out.push({
      id,
      prefix,
      label: str(r.label, MAX_LABEL),
      allowedApps: Array.isArray(r.allowed_apps) ? r.allowed_apps.filter((a): a is string => typeof a === "string" && isValidPackageName(a)) : [],
      lastUsedAt: date(r.last_used_at),
      revokedAt: date(r.revoked_at),
      createdAt,
    });
  }
  return out;
}

export function parseIngestEvents(rows: unknown): IngestEvent[] {
  if (!Array.isArray(rows)) return [];
  const out: IngestEvent[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const at = date(r.at);
    const outcome = (INGEST_OUTCOMES as readonly string[]).includes(r.outcome as string) ? (r.outcome as IngestOutcome) : null;
    if (typeof r.id !== "number" || !at || !outcome) continue;
    out.push({ id: r.id, app: str(r.app, 200), outcome, at });
  }
  return out;
}

// „Legutóbb érkezett appok": a friss eseményekből az egyedi csomagnevek (a legújabb elöl), azok nélkül, amik már engedélyezettek
export function recentApps(events: IngestEvent[], alreadyAllowed: string[], limit = 8): string[] {
  const out: string[] = [];
  for (const event of [...events].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))) {
    if (!event.app || !isValidPackageName(event.app) || alreadyAllowed.includes(event.app) || out.includes(event.app)) continue;
    out.push(event.app);
    if (out.length >= limit) break;
  }
  return out;
}

export type IngestStatus = { kind: "never" } | { kind: "recent"; at: string } | { kind: "stale"; at: string };

// „Utolsó esemény: 2 perce" / „több mint 24 órája nem jött semmi — ellenőrizd az akkumulátor-beállításokat"
export function ingestStatus(events: IngestEvent[], now: Date = new Date()): IngestStatus {
  const latest = events.reduce<string | null>((best, e) => (best === null || Date.parse(e.at) > Date.parse(best) ? e.at : best), null);
  if (!latest) return { kind: "never" };
  return now.getTime() - Date.parse(latest) > STALE_AFTER_MS ? { kind: "stale", at: latest } : { kind: "recent", at: latest };
}

export const activeTokens = (tokens: IngestToken[]) => tokens.filter((t) => t.revokedAt === null);

// A webhook címe: a Supabase-projekt Edge Function-je (publikus URL; a token a x-ingest-token fejlécben megy)
export function webhookUrl(supabaseUrl: string | undefined): string | null {
  if (!supabaseUrl) return null;
  try {
    const url = new URL(supabaseUrl);
    return url.protocol === "https:" ? `${url.origin}/functions/v1/ingest-notification` : null;
  } catch {
    return null;
  }
}

// A kérés törzse (advanced.md §5.1); a `<…>` részeket a telefon-oldali app a saját értesítés-változóival tölti ki
export const JSON_TEMPLATE = `{
  "app": "<az értesítést küldő app csomagneve>",
  "title": "<az értesítés címe>",
  "text": "<az értesítés szövege>"
}`;

export function curlExample(url: string): string {
  return `curl -X POST '${url}' \\
  -H 'x-ingest-token: <A_TOKENED>' \\
  -H 'Content-Type: application/json' \\
  -d '{"app":"hu.pelda.bank","title":"Kártyás vásárlás","text":"4 500 Ft — Teszt Étterem"}'`;
}
