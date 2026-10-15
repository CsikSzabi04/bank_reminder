import { describe, expect, it } from "vitest";
import {
  checkRuleKey,
  normalizeMerchantKey,
  parsePendingTransactions,
  parseRules,
  parseUnparsedEvents,
} from "@/lib/bank/rules";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
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

// ───────── besorolás / elvetés: atomi RPC-k (A-42) ─────────
// A tényleges besorolási logika (sorrend, retro-besorolás, tombstone, részleges írás nélküli hiba) SQL-ben él, és ott van tesztelve
// (supabase/tests/bank_rules.test.sql, mutációval). Itt a B-oldali szerződést védjük: az argumentumok, a hibakód-leképezés, a válasz-értelmezés.
type RpcResult = { data: unknown; error: { code?: string; message: string } | null };
function rpcClient(result: RpcResult | Error) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const client = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (result instanceof Error) throw result;
      return result;
    },
  } as unknown as SupabaseClient<Database>;
  return { client, calls };
}
const ok = (data: unknown): RpcResult => ({ data, error: null });
const err = (code?: string): RpcResult => ({ data: null, error: { code, message: "x" } });

describe("classifyTransactionCore (classify_bank_transaction RPC)", () => {
  it("az argumentumok a szerződés szerint mennek; a darabszám visszajön", async () => {
    const { client, calls } = rpcClient(ok({ classified: 3, rule_id: "r1" }));
    expect(await classifyTransactionCore(client, { transactionId: "t1", categoryId: CAT_FOOD, remember: true })).toEqual({ ok: true, data: { classified: 3 } });
    expect(calls).toEqual([{ fn: "classify_bank_transaction", args: { p_transaction: "t1", p_category: CAT_FOOD, p_remember: true } }]);
    const single = rpcClient(ok({ classified: 1, rule_id: null }));
    await classifyTransactionCore(single.client, { transactionId: "t1", categoryId: CAT_FOOD, remember: false });
    expect(single.calls[0].args.p_remember).toBe(false);
  });

  it("hibakód-leképezés: BR404 → not_found, BR422 → no_merchant_key, minden más → failed", async () => {
    const run = async (r: RpcResult | Error) => classifyTransactionCore(rpcClient(r).client, { transactionId: "t1", categoryId: CAT_FOOD, remember: true });
    expect(await run(err("BR404"))).toEqual({ ok: false, code: "not_found" });
    expect(await run(err("BR422"))).toEqual({ ok: false, code: "no_merchant_key" });
    for (const code of ["42501", "PGRST202", "23503", undefined]) expect(await run(err(code)), String(code)).toEqual({ ok: false, code: "failed" });
  });

  it("váratlan válasz-alak (nincs darabszám) nem számít sikernek", async () => {
    for (const data of [null, {}, { classified: "3" }, { classified: Number.NaN }, "ok"]) {
      expect(await classifyTransactionCore(rpcClient(ok(data)).client, { transactionId: "t1", categoryId: CAT_FOOD, remember: false }), JSON.stringify(data)).toEqual({ ok: false, code: "failed" });
    }
  });
});

describe("dismissTransactionCore (dismiss_bank_transaction RPC)", () => {
  it("siker, és a tétel azonosítója megy az RPC-nek", async () => {
    const { client, calls } = rpcClient(ok(null));
    expect(await dismissTransactionCore(client, "t1")).toEqual({ ok: true, data: null });
    expect(calls).toEqual([{ fn: "dismiss_bank_transaction", args: { p_transaction: "t1" } }]);
  });

  it("BR404 → not_found, más hiba → failed", async () => {
    expect(await dismissTransactionCore(rpcClient(err("BR404")).client, "t1")).toEqual({ ok: false, code: "not_found" });
    expect(await dismissTransactionCore(rpcClient(err("XX000")).client, "t1")).toEqual({ ok: false, code: "failed" });
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
