import type { AccountKind, BankAccount } from "./types";

// Az Enable `cash_account_type` → a UI három fajtája. A Revolut a CACC (folyó) és SVGS (megtakarítás) kódot adja.
export function accountKind(type: unknown): AccountKind {
  const code = typeof type === "string" ? type.toUpperCase() : "";
  if (code === "CACC") return "current";
  if (code === "SVGS") return "savings";
  return "other";
}

const text = (value: unknown, max: number): string | null =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

// A `bank_connections.accounts` jsonb-ből tűrően olvas: a szerver alakja az A-41-ben dől el, és a spike szerint
// nincs mindig IBAN. Kötelező csak egy kulcs (uid / identification_hash / id) és a pénznem; ami hiányzik, az `null`.
// A teljes IBAN-t a szerver sosem küldi — ha mégis jönne, itt is csak az utolsó 4 jegy marad.
export function parseAccounts(raw: unknown): BankAccount[] {
  if (!Array.isArray(raw)) return [];
  const out: BankAccount[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const a = item as Record<string, unknown>;
    const base = text(a.identification_hash, 128) ?? text(a.uid, 128) ?? text(a.id, 128);
    // a teljes értéket validáljuk (a csonkolás a „FORINT"-ot „FOR"-ra vágná, és átmenne)
    const currency = typeof a.currency === "string" && /^[A-Za-z]{3}$/.test(a.currency.trim()) ? a.currency.trim().toUpperCase() : null;
    if (!base || !currency) continue;
    // a számla kulcsa identification_hash + pénznem (A-41/A-40): egy IBAN-hoz tartozó HUF és USD számla hash-e egyezhet
    const key = `${base}:${currency}`;
    const ibanSource = text(a.iban_last4, 40) ?? text(a.iban, 40);
    const last4 = ibanSource ? ibanSource.replace(/\s+/g, "").slice(-4) : null;
    out.push({
      key,
      kind: accountKind(a.cash_account_type ?? a.type ?? a.kind),
      currency,
      name: text(a.name, 80),
      ibanLast4: last4 && /^[A-Za-z0-9]{4}$/.test(last4) ? last4 : null,
      syncEnabled: typeof a.sync_enabled === "boolean" ? a.sync_enabled : null,
    });
  }
  return out;
}
