import type { AccountKind, BankConnection } from "./types";

// A „Tranzakciók" szakasz tiszta logikája (A-48 szerződés): a bank_transactions sorok olvasása, a „mi lett belőle" besorolása,
// szűrők az URL-ből. Nincs I/O → tesztelhető.

export type TxDirection = "debit" | "credit";

export type BankTx = {
  id: string;
  bookedOn: string;
  direction: TxDirection;
  amount: number;
  currency: string;
  // a másik fél neve; ha nincs, a kereskedő
  who: string | null;
  remittance: string | null;
  accountRef: string | null;
  occurrenceId: string | null;
  contributionId: string | null;
  expenseId: string | null;
  categoryId: string | null;
  merchantKey: string | null;
  dismissed: boolean;
  source: "notification" | "bank";
};

// Az oszlopok felsorolva (oszlop-szintű jogok, H11) — a `select *` nem megengedett a kliensnek
export const TX_COLUMNS =
  "id, booked_on, direction, amount, currency, counterparty, merchant, remittance, account_ref, occurrence_id, contribution_id, expense_id, category_id, merchant_key, dismissed, source";

const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export function parseTransactions(rows: unknown): BankTx[] {
  if (!Array.isArray(rows)) return [];
  const out: BankTx[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = str(r.id, 64);
    const amount = typeof r.amount === "number" && Number.isFinite(r.amount) && r.amount > 0 ? r.amount : null;
    const currency = typeof r.currency === "string" && /^[A-Z]{3}$/.test(r.currency.trim()) ? r.currency.trim() : null;
    const bookedOn = typeof r.booked_on === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.booked_on) ? r.booked_on : null;
    if (!id || amount === null || !currency || !bookedOn) continue;
    out.push({
      id,
      bookedOn,
      // az `amount` mindig pozitív; az irányt a `direction` adja (hiányzó/ismeretlen érték = terhelés: a v1 csak terhelést ismert)
      direction: r.direction === "credit" ? "credit" : "debit",
      amount,
      currency,
      who: str(r.counterparty, 120) ?? str(r.merchant, 120),
      remittance: str(r.remittance, 300),
      accountRef: str(r.account_ref, 200),
      occurrenceId: str(r.occurrence_id, 64),
      contributionId: str(r.contribution_id, 64),
      expenseId: str(r.expense_id, 64),
      categoryId: str(r.category_id, 64),
      merchantKey: str(r.merchant_key, 60),
      dismissed: r.dismissed === true,
      source: r.source === "notification" ? "notification" : "bank",
    });
  }
  return out;
}

// „Mi lett belőle": egy banki tétel pontosan egyszer számít (A-48) — számla-kifizetés, megtakarítás vagy kiadás; a jóváírás csak megjelenik
export type TxOutcome =
  | { kind: "credit" }
  | { kind: "bill"; occurrenceId: string }
  | { kind: "saving"; contributionId: string }
  | { kind: "expense"; expenseId: string; categoryId: string | null }
  | { kind: "dismissed" }
  | { kind: "pending" };

export function txOutcome(tx: BankTx): TxOutcome {
  if (tx.direction === "credit") return { kind: "credit" };
  if (tx.dismissed) return { kind: "dismissed" };
  if (tx.occurrenceId) return { kind: "bill", occurrenceId: tx.occurrenceId };
  if (tx.contributionId) return { kind: "saving", contributionId: tx.contributionId };
  if (tx.expenseId) return { kind: "expense", expenseId: tx.expenseId, categoryId: tx.categoryId };
  return { kind: "pending" };
}

// ───────── szűrők (URL) ─────────
export const TX_PAGE_SIZE = 30;
export const TX_DIRECTIONS = ["all", "debit", "credit"] as const;
export type TxDirectionFilter = (typeof TX_DIRECTIONS)[number];

export type TxFilters = {
  account: string | null;
  direction: TxDirectionFilter;
  // "YYYY-MM" vagy null (minden hónap)
  month: string | null;
  q: string | null;
  page: number;
};

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

export function parseTxFilters(params: Record<string, string | string[] | undefined>): TxFilters {
  const direction = first(params.direction);
  const month = first(params.month);
  const q = first(params.q)?.trim().slice(0, 60);
  const page = Number.parseInt(first(params.page) ?? "1", 10);
  const account = first(params.account)?.trim();
  return {
    account: account && account.length <= 200 ? account : null,
    direction: (TX_DIRECTIONS as readonly string[]).includes(direction ?? "") ? (direction as TxDirectionFilter) : "all",
    month: month && MONTH.test(month) ? month : null,
    q: q ? q : null,
    page: Number.isFinite(page) && page >= 1 && page <= 1000 ? page : 1,
  };
}

// ISO időbélyeg „N órával ezelőttről" a friss tételek számolásához; a `now` paraméter a tesztelhetőséget adja
export const sinceHours = (hours: number, now: Date = new Date()): string => new Date(now.getTime() - hours * 3_600_000).toISOString();

// A hónap első és utolsó napja ("YYYY-MM" → [from, to])
export function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

// A kereső-szöveg szűrése a PostgREST `or(...ilike...)` feltételhez: a szűrő-szintaxis vezérlő karaktereit (`,` `(` `)` `%` `*` `\`)
// kivesszük, így a felhasználó szövege nem módosíthatja a feltétel szerkezetét
export function searchTerm(q: string): string {
  return q.replace(/[,()%*\\"'`;:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

// A számla-választó: a kapcsolatok számlái, kulcsuk az `account_ref` (`identification_hash:pénznem`) — ugyanaz, mint a B-41 számla-kulcsa
export type AccountOption = { ref: string; label: string };

export function accountOptions(connections: BankConnection[], labelFor: (kind: AccountKind) => string): AccountOption[] {
  const out: AccountOption[] = [];
  for (const connection of connections) {
    for (const account of connection.accounts) {
      const name = account.name ?? labelFor(account.kind);
      const last4 = account.ibanLast4 ? ` ····${account.ibanLast4}` : "";
      out.push({ ref: account.key, label: `${connection.aspspName} · ${name} · ${account.currency}${last4}` });
    }
  }
  return out;
}
