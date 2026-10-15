// Kereskedő-kulcs (A-42): a `bank_transactions.merchant_key` és a `merchant_rules.match_key` KÖZÖS alakja — ékezet- és kisbetű-független,
// csak betű/szám/szóköz. A B-oldali `lib/bank/rules.ts` normalizálójával azonos; a közös vektorok: tests/unit/bank-rules.test.ts ↔ merchant.test.ts.
// Az egyezés a szerződés: a „Ezt mindig így" a tétel `merchant_key`-éből készít szabályt, az illesztés „tartalmazza".
export const MATCH_KEY_MIN = 2;
export const MATCH_KEY_MAX = 60;

export function normalizeMerchantKey(input: string): string {
  return input
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')            // ékezetek
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')   // írásjelek, szimbólumok, többszörös szóköz → egy szóköz
    .trim();
}

/** A tárolandó kulcs: normalizált, legfeljebb 60 karakter (a szabály-kulcs felső korlátja), vagy null, ha nincs értelmes (≥ 2 karakteres) kulcs. */
export function merchantKey(name: string | null | undefined): string | null {
  if (!name) return null;
  const key = normalizeMerchantKey(name).slice(0, MATCH_KEY_MAX).trim();
  return key.length >= MATCH_KEY_MIN ? key : null;
}
