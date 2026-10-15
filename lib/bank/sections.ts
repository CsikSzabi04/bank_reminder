// A /bank oldal szakaszai (advanced.md §8.1). Az aktív szakasz az URL-ben él (`?section=…`),
// így megosztható és frissítés-biztos — mint a Profilnál.
export const BANK_SECTIONS = ["overview", "transactions", "android", "rules"] as const;
export type BankSection = (typeof BANK_SECTIONS)[number];

export const isBankSection = (value: string | undefined): value is BankSection =>
  (BANK_SECTIONS as readonly string[]).includes(value ?? "");

// Szakasz nélkül asztalon is választani kell egyet: akinek nincs Enable-jogosultsága (§2.1), annak az
// „Összekötés" csak magyarázat, ezért neki az Android-szakasz a nyitó oldal.
export function defaultBankSection(syncAllowed: boolean): BankSection {
  return syncAllowed ? "overview" : "android";
}
