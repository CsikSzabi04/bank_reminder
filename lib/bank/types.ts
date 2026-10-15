// A bank-összekötés B-oldali típusai (a szerződés: docs/CONTRACT_CHANGES.md „B-41 hívások"; a DB-oszlopok: advanced.md §4).
export const BANK_STATUSES = ["active", "expired", "revoked", "error"] as const;
export type BankStatus = (typeof BANK_STATUSES)[number];

// A számla fajtája az Enable `cash_account_type`-ából (A-40 lelet): a Revolut folyó- és megtakarítási számlát is ad
export type AccountKind = "current" | "savings" | "other";

export type BankAccount = {
  // a számla-kulcs NEM az IBAN (A-40: egy IBAN-hoz több pénznemű számla tartozhat, a megtakarításnak nincs IBAN-ja)
  key: string;
  kind: AccountKind;
  currency: string;
  name: string | null;
  ibanLast4: string | null;
  // `null` = a szerver nem közölte; nem találgatjuk
  syncEnabled: boolean | null;
};

export type BankConnection = {
  id: string;
  aspspName: string;
  aspspCountry: string;
  status: BankStatus;
  authorizedAt: string;
  validUntil: string;
  lastSyncAt: string | null;
  lastSyncOk: boolean | null;
  accounts: BankAccount[];
};

export type Aspsp = { name: string; country: string; maxConsentDays: number | null };

// A függvények hibakódjai (szerződés-javaslat); ismeretlen kód → "unknown"
export const BANK_ERROR_CODES = [
  "unauthenticated",
  "not_allowed",
  "unknown_bank",
  "state_invalid",
  "state_expired",
  "rate_limited",
  "upstream_failed",
  "not_found",
  "unavailable",
  "invalid_callback",
  "bank_denied",
  "bank_error",
  "unknown",
] as const;
export type BankErrorCode = (typeof BANK_ERROR_CODES)[number];

export const isBankErrorCode = (value: unknown): value is BankErrorCode =>
  typeof value === "string" && (BANK_ERROR_CODES as readonly string[]).includes(value);
