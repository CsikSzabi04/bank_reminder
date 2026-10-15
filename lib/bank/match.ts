import { MATCH_KEY_MAX, MATCH_KEY_MIN, normalizeMerchantKey } from "./rules";

// „Bank-egyeztetés kulcsszó" (`reminders.bank_match`, `savings_goals.bank_match`; A-48): egy szó, ami a banki tétel szövegében szerepel
// (pl. „anthropic" a Claude-hoz). A DB-trigger normalizálja (kisbetű, ékezet nélkül, csak betű/szám/szóköz; 2–60 karakter); a kliens
// UGYANAZT az alakot küldi, és a felhasználónak azonnal hibát mutat, ha a kulcs túl rövid/hosszú lenne.
export type BankMatchCheck = { ok: true; value: string | null } | { ok: false; reason: "bankMatchShort" | "bankMatchLong" };

export function checkBankMatch(input: string | null | undefined): BankMatchCheck {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: true, value: null };
  const key = normalizeMerchantKey(raw);
  if (key.length < MATCH_KEY_MIN) return { ok: false, reason: "bankMatchShort" };
  if (key.length > MATCH_KEY_MAX) return { ok: false, reason: "bankMatchLong" };
  return { ok: true, value: key };
}

// Az írandó oszlop-rész. Az oszlop a `db:push` előtt még nincs a DB-ben, ezért CSAK akkor küldjük, ha van mit írni:
// kitöltött értéknél, vagy ha korábban volt értéke és most törölték (null). Üres → üres mezőnél nem érintjük az oszlopot,
// így a mentés az oszlop nélküli adatbázison sem romlik el.
export function bankMatchPatch(value: string | null, hadValue: boolean): { bank_match?: string | null } {
  if (value !== null) return { bank_match: value };
  return hadValue ? { bank_match: null } : {};
}
