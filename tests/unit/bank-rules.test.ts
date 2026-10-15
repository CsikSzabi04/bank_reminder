import { describe, expect, it } from "vitest";
import {
  checkRuleKey,
  normalizeMerchantKey,
  parsePendingTransactions,
  parseRules,
  parseUnparsedEvents,
} from "@/lib/bank/rules";
import { classifyTransactionCore, deleteRuleCore, dismissTransactionCore, saveRuleCore } from "@/lib/bank/rules-service";
import { FakeDb } from "./support/fake-db";

const CAT_FOOD = "0b3f8a55-62c1-4a6e-9c1b-1f2d3e4a5b6c";
const CAT_OTHER = "1c4a9b66-73d2-4b7f-8d2c-2a3e4b5c6d7e";

describe("normalizeMerchantKey — a szabály-kulcs és a merchant_key közös alakja", () => {
  // Ezeket a vektorokat az A-42 normalizálójának is teljesítenie kell (a két oldal kulcsa nem térhet el)
  const vectors: [string, string][] = [
    ["Tesco Expressz", "tesco expressz"],
    ["Árvíztűrő Tükörfúrógép", "arvizturo tukorfurogep"],
    ["McDonald's Budapest*123", "mcdonald s budapest 123"],
    ["  OTP   Bank  ", "otp bank"],
    ["Café-Étterem", "cafe etterem"],
    ["ŐŰ őű", "ou ou"],
    ["Spar #0042", "spar 0042"],
    ["!!!", ""],
  ];
  it.each(vectors)("%s → %s", (input, expected) => {
    expect(normalizeMerchantKey(input)).toBe(expected);
  });

  it("idempotens: a normalizált kulcs újra normalizálva ugyanaz", () => {
    for (const [, key] of vectors) expect(normalizeMerchantKey(key)).toBe(key);
  });
});

describe("checkRuleKey", () => {
  it("2–60 karakter a normalizált kulcsra", () => {
    expect(checkRuleKey("  Tesco!! ")).toEqual({ ok: true, key: "tesco" });
    expect(checkRuleKey("a")).toEqual({ ok: false, reason: "tooShort" });
    expect(checkRuleKey("!!")).toEqual({ ok: false, reason: "tooShort" });
    expect(checkRuleKey("x".repeat(60))).toEqual({ ok: true, key: "x".repeat(60) });
    expect(checkRuleKey("x".repeat(61))).toEqual({ ok: false, reason: "tooLong" });
  });
});

describe("olvasók (tűrő parserek)", () => {
  it("függő tételek: hibás sor kimarad, a kulcs nélküli tételnél nincs merchantKey", () => {
    const rows = parsePendingTransactions([
      { id: "t1", source: "notification", status: "provisional", amount: 4500, currency: "HUF", booked_on: "2026-10-10", merchant: "Pizzéria", merchant_key: "pizzeria" },
      { id: "t2", source: "bank", status: "booked", amount: 100, currency: "EUR", booked_on: "2026-10-11", merchant: null, merchant_key: null },
      { id: "t3", amount: -1, currency: "HUF", booked_on: "2026-10-10" },
      { id: "t4", amount: 5, currency: "forint", booked_on: "2026-10-10" },
      { id: "t5", amount: 5, currency: "HUF", booked_on: "tegnap" },
      "x",
    ]);
    expect(rows.map((r) => r.id)).toEqual(["t1", "t2"]);
    expect(rows[0]).toMatchObject({ source: "notification", provisional: true, merchantKey: "pizzeria" });
    expect(rows[1]).toMatchObject({ source: "bank", provisional: false, merchantKey: null });
    expect(parsePendingTransactions(null)).toEqual([]);
  });

  it("szabályok: a rendszer-javaslat (user_id null) külön jelölt", () => {
    const rules = parseRules([
      { id: "r1", user_id: "u", match_key: "tesco", category_id: CAT_FOOD, hits: 3 },
      { id: "r2", user_id: null, match_key: "spar", category_id: CAT_FOOD, hits: 0 },
      { id: "r3", user_id: "u", match_key: "", category_id: CAT_FOOD },
    ]);
    expect(rules).toEqual([
      { id: "r1", matchKey: "tesco", categoryId: CAT_FOOD, hits: 3, system: false },
      { id: "r2", matchKey: "spar", categoryId: CAT_FOOD, hits: 0, system: true },
    ]);
  });

  it("nem értelmezett értesítések: csak nyers szöveggel rendelkező, érvényes sor", () => {
    expect(
      parseUnparsedEvents([
        { id: 1, app: "hu.bank", at: "2026-10-10T10:00:00Z", raw_text: "Ismeretlen formátum" },
        { id: 2, app: "x", at: "2026-10-10T10:00:00Z", raw_text: null },
        { id: "3", app: "x", at: "2026-10-10T10:00:00Z", raw_text: "x" },
        { id: 4, app: "x", at: "nem-dátum", raw_text: "x" },
      ]),
    ).toEqual([{ id: 1, app: "hu.bank", at: "2026-10-10T10:00:00Z", text: "Ismeretlen formátum" }]);
  });
});

// ───────── szolgáltatás-mag ─────────
function world() {
  const db = new FakeDb();
  db.seed("expenses", [
    { id: "e1", category_id: null, amount: 4500 },
    { id: "e2", category_id: null, amount: 3000 },
    { id: "e3", category_id: null, amount: 900 },
  ]);
  db.seed("bank_transactions", [
    { id: "t1", expense_id: "e1", merchant_key: "tesco", category_id: null, dismissed: false },
    { id: "t2", expense_id: "e2", merchant_key: "tesco expressz budapest", category_id: null, dismissed: false },
    { id: "t3", expense_id: "e3", merchant_key: "spar", category_id: null, dismissed: false },
    { id: "t4", expense_id: null, merchant_key: "tesco", category_id: null, dismissed: false },
    { id: "t5", expense_id: null, merchant_key: "tesco", category_id: CAT_OTHER, dismissed: false }, // már besorolt: nem nyúlunk hozzá
    { id: "t6", expense_id: null, merchant_key: "tesco", category_id: null, dismissed: true }, // „nem kiadás": nem éled újra
    { id: "t7", expense_id: "e9", merchant_key: null, category_id: null, dismissed: false },
  ]);
  return db;
}
const tx = (db: FakeDb, id: string) => db.rows("bank_transactions").find((r) => r.id === id)!;
const exp = (db: FakeDb, id: string) => db.rows("expenses").find((r) => r.id === id)!;

describe("classifyTransactionCore", () => {
  it("egy tétel besorolása: előbb a kiadás, utána a főkönyvi sor; szabály nem készül", async () => {
    const db = world();
    const res = await classifyTransactionCore(db.client(), { transactionId: "t3", categoryId: CAT_FOOD, remember: false });
    expect(res).toEqual({ ok: true, data: { classified: 1 } });
    expect(exp(db, "e3").category_id).toBe(CAT_FOOD);
    expect(tx(db, "t3").category_id).toBe(CAT_FOOD);
    expect(db.rows("merchant_rules")).toHaveLength(0);
    const writes = db.log.filter((l) => !l.startsWith("select"));
    expect(writes[0]).toContain("update:expenses");
    expect(writes[1]).toContain("update:bank_transactions");
  });

  it("kiadás nélküli főkönyvi tétel is besorolható (csak a főkönyvi sor változik)", async () => {
    const db = world();
    expect(await classifyTransactionCore(db.client(), { transactionId: "t4", categoryId: CAT_FOOD, remember: false })).toMatchObject({ ok: true });
    expect(tx(db, "t4").category_id).toBe(CAT_FOOD);
    expect(db.log.some((l) => l.startsWith("update:expenses"))).toBe(false);
  });

  it("„Ezt mindig így”: szabály készül a kereskedő-kulccsal, és a várakozó, azonos kereskedős tételek is besorolódnak", async () => {
    const db = world();
    const res = await classifyTransactionCore(db.client(), { transactionId: "t1", categoryId: CAT_FOOD, remember: true });
    expect(res).toEqual({ ok: true, data: { classified: 3 } }); // t1 + t2 (a kulcsot tartalmazza) + t4
    expect(db.rows("merchant_rules")).toMatchObject([{ match_key: "tesco", category_id: CAT_FOOD, user_id: "user-1" }]);
    for (const id of ["t1", "t2", "t4"]) expect(tx(db, id).category_id, id).toBe(CAT_FOOD);
    expect(exp(db, "e2").category_id).toBe(CAT_FOOD);
    // nem érintettek: más kereskedő, már besorolt, elvetett, kulcs nélküli
    expect(tx(db, "t3").category_id).toBeNull();
    expect(tx(db, "t5").category_id).toBe(CAT_OTHER);
    expect(tx(db, "t6").category_id).toBeNull();
    expect(tx(db, "t6").dismissed).toBe(true);
    expect(tx(db, "t7").category_id).toBeNull();
    expect(exp(db, "e3").category_id).toBeNull();
  });

  it("ha már van saját szabály ugyanarra a kulcsra, annak kategóriája frissül (nincs duplikátum); a rendszer-szabály nem akadály", async () => {
    const db = world();
    db.seed("merchant_rules", [
      { id: "own", user_id: "user-1", match_key: "tesco", category_id: CAT_OTHER },
      { id: "sys", user_id: null, match_key: "tesco", category_id: CAT_OTHER },
    ]);
    await classifyTransactionCore(db.client(), { transactionId: "t1", categoryId: CAT_FOOD, remember: true });
    expect(db.rows("merchant_rules").filter((r) => r.user_id === "user-1")).toHaveLength(1);
    expect(db.rows("merchant_rules").find((r) => r.id === "own")?.category_id).toBe(CAT_FOOD);
    expect(db.rows("merchant_rules").find((r) => r.id === "sys")?.category_id).toBe(CAT_OTHER);

    const db2 = world();
    db2.seed("merchant_rules", [{ id: "sys", user_id: null, match_key: "tesco", category_id: CAT_OTHER }]);
    await classifyTransactionCore(db2.client(), { transactionId: "t1", categoryId: CAT_FOOD, remember: true });
    expect(db2.rows("merchant_rules").filter((r) => r.user_id === "user-1")).toHaveLength(1);
  });

  it("kereskedő-kulcs nélküli tételnél a „mindig így” elutasított, és SEMMI nem íródik (nincs félig besorolt tétel)", async () => {
    const db = world();
    const before = JSON.stringify(db.tables);
    expect(await classifyTransactionCore(db.client(), { transactionId: "t7", categoryId: CAT_FOOD, remember: true })).toEqual({ ok: false, code: "no_merchant_key" });
    expect(JSON.stringify(db.tables)).toBe(before);
  });

  it("ismeretlen vagy elvetett tétel → not_found, nincs írás", async () => {
    const db = world();
    expect(await classifyTransactionCore(db.client(), { transactionId: "nincs", categoryId: CAT_FOOD, remember: false })).toEqual({ ok: false, code: "not_found" });
    expect(await classifyTransactionCore(db.client(), { transactionId: "t6", categoryId: CAT_FOOD, remember: false })).toEqual({ ok: false, code: "not_found" });
    expect(db.log.some((l) => !l.startsWith("select"))).toBe(false);
  });

  it("a kiadás frissítése elbukik → a főkönyvi sor érintetlen (a tétel a listán marad), az ismétlés helyreállít", async () => {
    const db = world().failOn("expenses", "update");
    expect(await classifyTransactionCore(db.client(), { transactionId: "t1", categoryId: CAT_FOOD, remember: false })).toEqual({ ok: false, code: "failed" });
    expect(tx(db, "t1").category_id).toBeNull();
    db.clearFaults();
    expect(await classifyTransactionCore(db.client(), { transactionId: "t1", categoryId: CAT_FOOD, remember: false })).toMatchObject({ ok: true });
    expect(exp(db, "e1").category_id).toBe(CAT_FOOD);
    expect(tx(db, "t1").category_id).toBe(CAT_FOOD);
  });

  it("a főkönyvi sor frissítése bukik → a tétel a „Besorolásra vár” listán marad (category_id null), az ismétlés idempotens", async () => {
    const db = world().failOn("bank_transactions", "update");
    expect(await classifyTransactionCore(db.client(), { transactionId: "t1", categoryId: CAT_FOOD, remember: false })).toEqual({ ok: false, code: "failed" });
    expect(tx(db, "t1").category_id).toBeNull(); // még a listán van
    db.clearFaults();
    expect(await classifyTransactionCore(db.client(), { transactionId: "t1", categoryId: CAT_FOOD, remember: false })).toMatchObject({ ok: true });
    expect(tx(db, "t1").category_id).toBe(CAT_FOOD);
  });
});

describe("dismissTransactionCore — „Ez nem kiadás”", () => {
  it("a kiadás törlődik, a főkönyvi sor dismissed lesz, és a „Besorolásra vár” szűrő már nem hozza vissza", async () => {
    const db = world();
    expect(await dismissTransactionCore(db.client(), "t1")).toEqual({ ok: true, data: null });
    expect(db.rows("expenses").some((r) => r.id === "e1")).toBe(false);
    expect(tx(db, "t1")).toMatchObject({ dismissed: true, expense_id: null });
    const pending = db.rows("bank_transactions").filter((r) => r.category_id === null && r.dismissed === false).map((r) => r.id);
    expect(pending).not.toContain("t1");
  });

  it("kiadás nélküli tételnél is dismissed lesz; ismeretlen → not_found", async () => {
    const db = world();
    expect(await dismissTransactionCore(db.client(), "t4")).toMatchObject({ ok: true });
    expect(tx(db, "t4").dismissed).toBe(true);
    expect(await dismissTransactionCore(db.client(), "nincs")).toEqual({ ok: false, code: "not_found" });
  });

  it("ha a kiadás törlése bukik, a tétel NEM lesz dismissed (nem marad kiadás nélküli árva)", async () => {
    const db = world().failOn("expenses", "delete");
    expect(await dismissTransactionCore(db.client(), "t1")).toEqual({ ok: false, code: "failed" });
    expect(tx(db, "t1").dismissed).toBe(false);
    expect(db.rows("expenses").some((r) => r.id === "e1")).toBe(true);
  });
});

describe("szabály-CRUD", () => {
  it("létrehozás: a kulcs normalizált; ugyanaz a kulcs másodszor → duplicate", async () => {
    const db = new FakeDb();
    const first = await saveRuleCore(db.client(), { matchKey: "  Árpád Étterem! ", categoryId: CAT_FOOD });
    expect(first.ok).toBe(true);
    expect(db.rows("merchant_rules")[0]).toMatchObject({ match_key: "arpad etterem", category_id: CAT_FOOD });
    expect(await saveRuleCore(db.client(), { matchKey: "ÁRPÁD étterem", categoryId: CAT_OTHER })).toEqual({ ok: false, code: "duplicate" });
  });

  it("érvénytelen kulcs → hibakód, nincs írás", async () => {
    const db = new FakeDb();
    expect(await saveRuleCore(db.client(), { matchKey: "a", categoryId: CAT_FOOD })).toEqual({ ok: false, code: "key_too_short" });
    expect(await saveRuleCore(db.client(), { matchKey: "x".repeat(61), categoryId: CAT_FOOD })).toEqual({ ok: false, code: "key_too_long" });
    expect(db.log).toEqual([]);
  });

  it("szerkesztés: a saját szabály módosítható; a rendszer-szabály és a nemlétező nem (not_found); meglévő kulcsra átnevezés → duplicate", async () => {
    const db = new FakeDb().seed("merchant_rules", [
      { id: "own", user_id: "user-1", match_key: "tesco", category_id: CAT_FOOD },
      { id: "own2", user_id: "user-1", match_key: "spar", category_id: CAT_FOOD },
      { id: "sys", user_id: null, match_key: "lidl", category_id: CAT_FOOD },
    ]);
    expect(await saveRuleCore(db.client(), { id: "own", matchKey: "Tesco Expressz", categoryId: CAT_OTHER })).toEqual({ ok: true, data: { id: "own" } });
    expect(db.rows("merchant_rules").find((r) => r.id === "own")).toMatchObject({ match_key: "tesco expressz", category_id: CAT_OTHER });
    expect(await saveRuleCore(db.client(), { id: "sys", matchKey: "lidl", categoryId: CAT_OTHER })).toEqual({ ok: false, code: "not_found" });
    expect(db.rows("merchant_rules").find((r) => r.id === "sys")?.category_id).toBe(CAT_FOOD);
    expect(await saveRuleCore(db.client(), { id: "nincs", matchKey: "valami", categoryId: CAT_OTHER })).toEqual({ ok: false, code: "not_found" });
    expect(await saveRuleCore(db.client(), { id: "own", matchKey: "spar", categoryId: CAT_OTHER })).toEqual({ ok: false, code: "duplicate" });
  });

  it("törlés: a saját szabály törölhető; a rendszer-szabály és a nemlétező nem", async () => {
    const db = new FakeDb().seed("merchant_rules", [
      { id: "own", user_id: "user-1", match_key: "tesco", category_id: CAT_FOOD },
      { id: "sys", user_id: null, match_key: "lidl", category_id: CAT_FOOD },
    ]);
    expect(await deleteRuleCore(db.client(), "own")).toEqual({ ok: true, data: null });
    expect(await deleteRuleCore(db.client(), "sys")).toEqual({ ok: false, code: "not_found" });
    expect(await deleteRuleCore(db.client(), "nincs")).toEqual({ ok: false, code: "not_found" });
    expect(db.rows("merchant_rules").map((r) => r.id)).toEqual(["sys"]);
  });
});
