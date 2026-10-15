import { MAX_LABEL, normalizeApps, type AppsCheck } from "./ingest";

// A webhook-token kezelése (A-44 RPC-k; advanced.md §10.2): injektált klienssel → fake-kel tesztelhető.
// Az RPC-k az A-44-gyel érkeznek, ezért szűk kézi kliens-alak (a generált típusban még nincsenek).
export type IngestRpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
};

export type IngestError = "unavailable" | "invalid_apps" | "too_many_apps" | "apps_too_long" | "label_too_long" | "not_found" | "limit_reached" | "failed";
export type IngestResult<T> = { ok: true; data: T } | { ok: false; code: IngestError };

const failed = { ok: false, code: "failed" } as const;

// PGRST202 / 42883: a függvény nincs telepítve (A-44 előtt) → „még nem elérhető", nem hiba; 53400 = darab-limit; P0002 = nincs/idegen token
function mapError(error: { code?: string } | null): IngestResult<never> {
  switch (error?.code) {
    case "PGRST202":
    case "42883":
      return { ok: false, code: "unavailable" };
    case "53400":
      return { ok: false, code: "limit_reached" };
    case "P0002":
      return { ok: false, code: "not_found" };
    default:
      return failed;
  }
}

const appsError = (check: Extract<AppsCheck, { ok: false }>): IngestError =>
  check.reason === "invalid" ? "invalid_apps" : check.reason === "tooMany" ? "too_many_apps" : "apps_too_long";

export type CreatedToken = { id: string; token: string; prefix: string };

// A nyers token CSAK itt, a létrehozás válaszában létezik — a szerver csak a hash-ét őrzi; a hívó egyszer mutatja meg
export async function createTokenCore(db: IngestRpcClient, input: { label: string; apps: string[] }): Promise<IngestResult<CreatedToken>> {
  const label = input.label.trim();
  if (label.length > MAX_LABEL) return { ok: false, code: "label_too_long" };
  const apps = normalizeApps(input.apps);
  if (!apps.ok) return { ok: false, code: appsError(apps) };

  const { data, error } = await db.rpc("create_ingest_token", { p_label: label || null, p_allowed_apps: apps.apps });
  if (error) return mapError(error);
  const o = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const { id, token, prefix } = o;
  // a token a szerver generálta, hosszú véletlen; a rövid/hiányzó érték hibás szerver-válasz, nem mutatjuk meg
  if (typeof id !== "string" || typeof token !== "string" || token.length < 20 || typeof prefix !== "string") return failed;
  return { ok: true, data: { id, token, prefix } };
}

export async function revokeTokenCore(db: IngestRpcClient, tokenId: string): Promise<IngestResult<null>> {
  const { error } = await db.rpc("revoke_ingest_token", { p_token: tokenId });
  return error ? mapError(error) : { ok: true, data: null };
}

export async function setAppsCore(db: IngestRpcClient, tokenId: string, appsInput: string[]): Promise<IngestResult<{ apps: string[] }>> {
  const apps = normalizeApps(appsInput);
  if (!apps.ok) return { ok: false, code: appsError(apps) };
  const { error } = await db.rpc("set_ingest_apps", { p_token: tokenId, p_apps: apps.apps });
  return error ? mapError(error) : { ok: true, data: { apps: apps.apps } };
}

// Újragenerálás: ELŐSZÖR az új token jön létre (ugyanazzal a címkével és engedélyezett appokkal), UTÁNA vonjuk vissza a régit.
// Ha a visszavonás bukik, két token él (biztonságos irány: a felhasználó látja és kézzel visszavonhatja); fordítva egy hiba
// után token nélkül maradna, és a telefon-oldali beállítás elromlana.
export async function regenerateTokenCore(
  db: IngestRpcClient,
  old: { id: string; label: string; apps: string[] },
): Promise<IngestResult<CreatedToken & { oldRevoked: boolean }>> {
  const created = await createTokenCore(db, { label: old.label, apps: old.apps });
  if (!created.ok) return created;
  const revoked = await revokeTokenCore(db, old.id);
  return { ok: true, data: { ...created.data, oldRevoked: revoked.ok } };
}
