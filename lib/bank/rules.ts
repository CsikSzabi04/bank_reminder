// Kereskedő-szabályok és a „Besorolásra vár" lista tiszta logikája (advanced.md §8.4). Nincs I/O → tesztelhető.

// A szabály-kulcs (`match_key`) és a tétel `merchant_key`-e ugyanabban az alakban él: ékezet- és kisbetű-független, csak betű/szám/szóköz.
// (A `merchant_key`-t a szerver-oldali normalizáló adja, A-42; ennek egyeznie kell vele — a közös teszt-vektorok: tests/unit/bank-rules.test.ts.)
export const MATCH_KEY_MIN = 2;
export const MATCH_KEY_MAX = 60;

export function normalizeMerchantKey(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{M}+/gu, "") // ékezetek
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ") // írásjelek, szimbólumok, többszörös szóköz → egy szóköz
    .trim();
}

export type RuleKeyCheck = { ok: true; key: string } | { ok: false; reason: "tooShort" | "tooLong" };

export function checkRuleKey(input: string): RuleKeyCheck {
  const key = normalizeMerchantKey(input);
  if (key.length < MATCH_KEY_MIN) return { ok: false, reason: "tooShort" };
  if (key.length > MATCH_KEY_MAX) return { ok: false, reason: "tooLong" };
  return { ok: true, key };
}

export type PendingTransaction = {
  id: string;
  source: "notification" | "bank";
  provisional: boolean;
  amount: number;
  currency: string;
  bookedOn: string;
  merchant: string | null;
  // szabály csak ebből hozható létre; ha nincs, a „Ezt mindig így" nem elérhető
  merchantKey: string | null;
};

const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export function parsePendingTransactions(rows: unknown): PendingTransaction[] {
  if (!Array.isArray(rows)) return [];
  const out: PendingTransaction[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = str(r.id, 64);
    const amount = typeof r.amount === "number" && Number.isFinite(r.amount) && r.amount > 0 ? r.amount : null;
    const currency = typeof r.currency === "string" && /^[A-Z]{3}$/.test(r.currency.trim()) ? r.currency.trim() : null;
    const bookedOn = typeof r.booked_on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.booked_on) ? r.booked_on : null;
    if (!id || amount === null || !currency || !bookedOn) continue;
    const merchantKey = str(r.merchant_key, MATCH_KEY_MAX);
    out.push({
      id,
      source: r.source === "bank" ? "bank" : "notification",
      provisional: r.status === "provisional",
      amount,
      currency,
      bookedOn,
      merchant: str(r.merchant, 80),
      merchantKey: merchantKey && merchantKey.length >= MATCH_KEY_MIN ? merchantKey : null,
    });
  }
  return out;
}

export type MerchantRule = {
  id: string;
  matchKey: string;
  categoryId: string;
  hits: number;
  // rendszer-javaslat (user_id null): csak olvasható, nem állít tényt a kereskedőkről (§8.4)
  system: boolean;
};

export function parseRules(rows: unknown): MerchantRule[] {
  if (!Array.isArray(rows)) return [];
  const out: MerchantRule[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = str(r.id, 64);
    const matchKey = str(r.match_key, MATCH_KEY_MAX);
    const categoryId = str(r.category_id, 64);
    if (!id || !matchKey || !categoryId) continue;
    out.push({ id, matchKey, categoryId, hits: typeof r.hits === "number" && r.hits > 0 ? Math.floor(r.hits) : 0, system: r.user_id === null });
  }
  return out;
}

export type UnparsedEvent = { id: number; app: string | null; at: string; text: string };

// A feldolgozhatatlan értesítések (nyers szöveg csak ezeknél marad, 14 napig — advanced.md §2.5)
export function parseUnparsedEvents(rows: unknown): UnparsedEvent[] {
  if (!Array.isArray(rows)) return [];
  const out: UnparsedEvent[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const text = str(r.raw_text, 600);
    if (typeof r.id !== "number" || typeof r.at !== "string" || Number.isNaN(Date.parse(r.at)) || !text) continue;
    out.push({ id: r.id, app: str(r.app, 200), at: r.at, text });
  }
  return out;
}
