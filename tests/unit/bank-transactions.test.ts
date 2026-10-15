import { describe, expect, it } from "vitest";
import { accountOptions, monthBounds, parseTransactions, parseTxFilters, searchTerm, txOutcome, TX_COLUMNS, type BankTx } from "@/lib/bank/transactions";
import { parseConnections } from "@/lib/bank/connections";

const base = { id: "t1", booked_on: "2026-10-10", direction: "debit", amount: 4500, currency: "HUF", counterparty: null, merchant: null, remittance: null };

describe("parseTransactions", () => {
  it("a másik fél neve: counterparty, ennek híján a kereskedő; a hibás sor kimarad", () => {
    const rows = parseTransactions([
      { ...base, id: "a", counterparty: "Tesco Kft.", merchant: "tesco" },
      { ...base, id: "b", merchant: "Spar" },
      { ...base, id: "c" },
      { ...base, id: "d", amount: 0 },
      { ...base, id: "e", amount: -5 },
      { ...base, id: "f", currency: "forint" },
      { ...base, id: "g", booked_on: "tegnap" },
      { ...base, id: null },
      "x",
    ]);
    expect(rows.map((r) => [r.id, r.who])).toEqual([
      ["a", "Tesco Kft."],
      ["b", "Spar"],
      ["c", null],
    ]);
    expect(parseTransactions(undefined)).toEqual([]);
  });

  it("az irány: csak a pontos „credit” jóváírás; minden más (hiányzó is) terhelés; az összeg pozitív marad", () => {
    expect(parseTransactions([{ ...base, direction: "credit" }])[0]).toMatchObject({ direction: "credit", amount: 4500 });
    for (const d of ["debit", undefined, "CREDIT", "x", 1]) expect(parseTransactions([{ ...base, direction: d }])[0].direction, String(d)).toBe("debit");
  });

  it("a kapcsolt azonosítók és a forrás átjön; üres szöveg null", () => {
    const [tx] = parseTransactions([{ ...base, occurrence_id: "o1", contribution_id: "c1", expense_id: "e1", category_id: "k1", merchant_key: "tesco", remittance: "  ", source: "notification", dismissed: true, account_ref: "h:HUF" }]);
    expect(tx).toMatchObject({ occurrenceId: "o1", contributionId: "c1", expenseId: "e1", categoryId: "k1", merchantKey: "tesco", remittance: null, source: "notification", dismissed: true, accountRef: "h:HUF" });
  });

  it("a lekérdezés oszlopai fel vannak sorolva (nincs select *)", () => {
    expect(TX_COLUMNS).not.toContain("*");
    for (const col of ["direction", "counterparty", "occurrence_id", "contribution_id", "expense_id", "account_ref"]) expect(TX_COLUMNS).toContain(col);
  });
});

describe("txOutcome — egy banki tétel pontosan egyszer számít", () => {
  const tx = (over: Partial<BankTx>): BankTx => ({
    id: "t", bookedOn: "2026-10-10", direction: "debit", amount: 1, currency: "HUF", who: null, remittance: null, accountRef: null,
    occurrenceId: null, contributionId: null, expenseId: null, categoryId: null, merchantKey: null, dismissed: false, source: "bank", ...over,
  });

  it("jóváírás csak megjelenik, akkor is, ha valamilyen kapcsolat mégis van rajta", () => {
    expect(txOutcome(tx({ direction: "credit" }))).toEqual({ kind: "credit" });
    expect(txOutcome(tx({ direction: "credit", expenseId: "e" }))).toEqual({ kind: "credit" });
  });

  it("terhelés: számla-kifizetés → megtakarítás → kiadás sorrendben; az elvetett mindent felülír", () => {
    expect(txOutcome(tx({ occurrenceId: "o", contributionId: "c", expenseId: "e" }))).toEqual({ kind: "bill", occurrenceId: "o" });
    expect(txOutcome(tx({ contributionId: "c", expenseId: "e" }))).toEqual({ kind: "saving", contributionId: "c" });
    expect(txOutcome(tx({ expenseId: "e", categoryId: "k" }))).toEqual({ kind: "expense", expenseId: "e", categoryId: "k" });
    expect(txOutcome(tx({ expenseId: "e" }))).toEqual({ kind: "expense", expenseId: "e", categoryId: null });
    expect(txOutcome(tx({ occurrenceId: "o", dismissed: true }))).toEqual({ kind: "dismissed" });
  });

  it("kapcsolat nélküli terhelés még feldolgozásra vár", () => {
    expect(txOutcome(tx({}))).toEqual({ kind: "pending" });
  });
});

describe("parseTxFilters (URL)", () => {
  it("alapértékek", () => {
    expect(parseTxFilters({})).toEqual({ account: null, direction: "all", month: null, q: null, page: 1 });
  });

  it("érvényes értékek átjönnek; tömb esetén az első; a kereső vágott", () => {
    expect(parseTxFilters({ direction: "credit", month: "2026-10", q: "  tesco  ", page: "3", account: "h:HUF" })).toEqual({ account: "h:HUF", direction: "credit", month: "2026-10", q: "tesco", page: 3 });
    expect(parseTxFilters({ direction: ["debit", "credit"] }).direction).toBe("debit");
    expect(parseTxFilters({ q: "x".repeat(200) }).q).toHaveLength(60);
  });

  it("érvénytelen értékek az alapra esnek (nem dobnak, nem szivárognak tovább)", () => {
    expect(parseTxFilters({ direction: "bármi", month: "2026-13", page: "-4" })).toMatchObject({ direction: "all", month: null, page: 1 });
    expect(parseTxFilters({ month: "2026-1", page: "abc" })).toMatchObject({ month: null, page: 1 });
    expect(parseTxFilters({ page: "999999" }).page).toBe(1);
    expect(parseTxFilters({ account: "x".repeat(300) }).account).toBeNull();
  });
});

describe("monthBounds és searchTerm", () => {
  it("a hónap első és utolsó napja (szökőév is)", () => {
    expect(monthBounds("2026-10")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(monthBounds("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthBounds("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(monthBounds("2026-12").to).toBe("2026-12-31");
  });

  it("a keresőből a PostgREST-szűrő vezérlő karakterei kiesnek (nem módosíthatják a feltétel szerkezetét)", () => {
    expect(searchTerm("tesco")).toBe("tesco");
    expect(searchTerm("a,b)(c%d*e\\f\"g'h;i:j")).toBe("a b c d e f g h i j");
    expect(searchTerm("x.eq.1),amount.gt.0")).not.toMatch(/[,()]/);
    expect(searchTerm("  sok   szóköz ")).toBe("sok szóköz");
    expect(searchTerm("a".repeat(100))).toHaveLength(60);
  });
});

describe("accountOptions — a számla-választó", () => {
  it("a kulcs a B-41 számla-kulcsa (identification_hash:pénznem); azonos hash-ű HUF/USD külön opció; IBAN csak az utolsó 4 jegy", () => {
    const connections = parseConnections([
      {
        id: "c1", aspsp_name: "Revolut", aspsp_country: "HU", status: "active", authorized_at: "2026-04-18T08:00:00Z", consent_valid_until: "2026-10-15T08:00:00Z",
        accounts: [
          { identification_hash: "h", cash_account_type: "CACC", currency: "HUF", iban_last4: "6581", name: "Fő" },
          { identification_hash: "h", cash_account_type: "CACC", currency: "USD", iban_last4: "6581" },
          { identification_hash: "s", cash_account_type: "SVGS", currency: "HUF" },
        ],
      },
    ]);
    const options = accountOptions(connections, (kind) => ({ current: "Folyószámla", savings: "Megtakarítás", other: "Számla" })[kind]);
    expect(options.map((o) => o.ref)).toEqual(["h:HUF", "h:USD", "s:HUF"]);
    expect(options[0].label).toBe("Revolut · Fő · HUF ····6581");
    expect(options[1].label).toBe("Revolut · Folyószámla · USD ····6581");
    expect(options[2].label).toBe("Revolut · Megtakarítás · HUF");
  });
});
