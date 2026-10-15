import { BANK_CONSENT_NOTIFY_DAYS_BEFORE } from "@/lib/constants";
import { parseAccounts } from "./accounts";
import { consentDaysLeft } from "./consent";
import { BANK_STATUSES, type BankConnection, type BankStatus } from "./types";

const str = (value: unknown, max: number): string | null => (typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null);
const validDate = (value: unknown): string | null => (typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null);

// A `bank_connections` sorokból (RLS: csak a sajátok) tűrően olvas; a hibás sor kimarad, nem dönti el az oldalt.
// A session-azonosító és a hibaszöveg SOSEM kerül a kliensre (advanced.md §4) — nem is kérjük le.
export const BANK_CONNECTION_COLUMNS =
  "id, aspsp_name, aspsp_country, status, authorized_at, consent_valid_until, last_sync_at, last_sync_ok, accounts";

export function parseConnections(rows: unknown): BankConnection[] {
  if (!Array.isArray(rows)) return [];
  const out: BankConnection[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = str(r.id, 64);
    const aspspName = str(r.aspsp_name, 100);
    const authorizedAt = validDate(r.authorized_at);
    const validUntil = validDate(r.consent_valid_until);
    if (!id || !aspspName || !authorizedAt || !validUntil) continue;
    const status = (BANK_STATUSES as readonly string[]).includes(r.status as string) ? (r.status as BankStatus) : "error";
    out.push({
      id,
      aspspName,
      aspspCountry: str(r.aspsp_country, 2)?.toUpperCase() ?? "",
      status,
      authorizedAt,
      validUntil,
      lastSyncAt: validDate(r.last_sync_at),
      lastSyncOk: typeof r.last_sync_ok === "boolean" ? r.last_sync_ok : null,
      accounts: parseAccounts(r.accounts),
    });
  }
  return out;
}

// A kártya állapota ikonnal+szöveggel jelenik meg (nem csak színnel); a „hamarosan lejár" az első értesítés napjától (30) él
export type ConnectionState = "active" | "soon" | "expired" | "error" | "revoked";

export type ConnectionHealth = {
  state: ConnectionState;
  daysLeft: number;
  // az eltelt rész a teljes hozzáférésből (0…1), a sávhoz
  elapsed: number;
};

export function connectionHealth(connection: BankConnection, timeZone: string, now: Date = new Date()): ConnectionHealth {
  const daysLeft = consentDaysLeft({ validUntil: connection.validUntil, timeZone, now });
  const total = Date.parse(connection.validUntil) - Date.parse(connection.authorizedAt);
  const elapsed = total > 0 ? Math.min(1, Math.max(0, (now.getTime() - Date.parse(connection.authorizedAt)) / total)) : 1;

  let state: ConnectionState;
  if (connection.status === "revoked") state = "revoked";
  else if (connection.status === "expired" || daysLeft < 0) state = "expired";
  else if (connection.status === "error") state = "error";
  else state = daysLeft <= BANK_CONSENT_NOTIFY_DAYS_BEFORE[0] ? "soon" : "active";
  return { state, daysLeft, elapsed };
}

// A Főoldal figyelmeztető sávja (advanced.md §8.5): ha van kapcsolat, és ≤ 30 nap van hátra (vagy már lejárt), a legsürgősebbről szól.
export type ConsentBannerInfo = { bank: string; daysLeft: number; expired: boolean };

export function consentBannerInfo(connections: BankConnection[], timeZone: string, now: Date = new Date()): ConsentBannerInfo | null {
  let best: ConsentBannerInfo | null = null;
  for (const connection of connections) {
    // a visszavont kapcsolat állapota „revoked”, ezért kimarad (nincs mit frissíteni)
    const { state, daysLeft } = connectionHealth(connection, timeZone, now);
    if (state !== "soon" && state !== "expired") continue;
    if (!best || daysLeft < best.daysLeft) best = { bank: connection.aspspName, daysLeft, expired: state === "expired" };
  }
  return best;
}
