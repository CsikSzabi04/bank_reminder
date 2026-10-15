// Az Enable-szakasz kapuja: `profiles.bank_sync_allowed` (advanced.md §2.1) — csak a gazda állíthatja,
// a kliens nem írhatja. Tiszta függvény, hogy az oldal nélkül is tesztelhető legyen.
export type BankAccess = { syncAllowed: boolean };

type ProfileQuery = {
  data: unknown;
  error: { code?: string; message?: string } | null;
};

// 42703 = undefined_column (PostgREST közvetíti), PGRST204 = a séma-gyorsítótárban nincs oszlop
const MISSING_COLUMN_CODES = new Set(["42703", "PGRST204"]);

// Az oszlop hiánya (A-41 migráció még nem ment fel) nem hiba, hanem „nincs jogosultság": a /bank
// ilyenkor is használható (Android-szakasz). Minden más hiba továbbdobódik → az error boundary kezeli.
export function interpretBankAccess({ data, error }: ProfileQuery): BankAccess {
  if (error) {
    if (error.code && MISSING_COLUMN_CODES.has(error.code)) return { syncAllowed: false };
    throw new Error(`bank_access_query_failed:${error.code ?? "unknown"}`);
  }
  const flag = (data as { bank_sync_allowed?: unknown } | null)?.bank_sync_allowed;
  return { syncAllowed: flag === true };
}
