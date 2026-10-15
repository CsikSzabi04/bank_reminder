// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeMerchantKey } from "@/lib/bank/rules";

// A szabály-kulcs (B) és a `merchant_key` (A, Deno: supabase/functions/_shared/merchant.ts) ugyanaz a normalizált alak kell legyen,
// különben a „Ezt mindig így" szabály nem találja az új tételeket. Az A-oldali vektor-lista a `merchant.test.ts`-ben él, kézzel tartott;
// ez a teszt BEOLVASSA azt, és a B-oldali normalizálóval futtatja → bármelyik oldal eltérése bukást ad.
const SRC = readFileSync(join(process.cwd(), "supabase", "functions", "_shared", "merchant.test.ts"), "utf8");

const STR = String.raw`(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")`;
const PAIR = new RegExp(String.raw`\[\s*${STR}\s*,\s*${STR}\s*\]`, "g");
const unescape = (s: string) => s.replace(/\\(.)/g, "$1");

export function readVectors(source: string): [string, string][] {
  const block = /const vectors[^=]*=\s*\[([\s\S]*?)\n\];/.exec(source)?.[1] ?? "";
  return [...block.matchAll(PAIR)].map((m) => [unescape(m[1] ?? m[2] ?? ""), unescape(m[3] ?? m[4] ?? "")]);
}

describe("merchant_key paritás: az A-oldali vektorok a B-oldali normalizálón is teljesülnek", () => {
  const vectors = readVectors(SRC);

  it("a vektor-lista beolvasható (nem üres és nem csonka — különben a teszt üres lenne)", () => {
    expect(vectors.length).toBeGreaterThanOrEqual(8);
    expect(vectors).toContainEqual(["Árvíztűrő Tükörfúrógép", "arvizturo tukorfurogep"]);
    expect(vectors).toContainEqual(["McDonald's Budapest*123", "mcdonald s budapest 123"]);
  });

  it("minden A-oldali vektor: a B normalizáló ugyanazt adja", () => {
    for (const [input, expected] of vectors) expect(normalizeMerchantKey(input), input).toBe(expected);
  });

  it("a B normalizáló az A-oldali kimeneteken idempotens", () => {
    for (const [, expected] of vectors) expect(normalizeMerchantKey(expected), expected).toBe(expected);
  });

  it("a beolvasó felismeri az egyszeres és kettős idézőjelet és a feloldójelet", () => {
    const sample = "const vectors: [string, string][] = [\n  ['a\\'b', 'a b'],\n  [\"c'd\", 'c d'],\n];";
    expect(readVectors(sample)).toEqual([
      ["a'b", "a b"],
      ["c'd", "c d"],
    ]);
  });
});
