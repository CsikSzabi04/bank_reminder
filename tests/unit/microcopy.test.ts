import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Szöveg-higiénia a locales-on (B-31 microcopy-átnézés őre): a kulcs-paritást az i18n:check adja, ez a tartalmi hibákat fogja meg
const read = (l: string) => JSON.parse(readFileSync(join(process.cwd(), "locales", `${l}.json`), "utf8")) as Record<string, unknown>;

function flat(d: Record<string, unknown>, prefix = ""): Array<[string, string]> {
  return Object.entries(d).flatMap(([k, v]) => (typeof v === "object" && v !== null ? flat(v as Record<string, unknown>, `${prefix}${k}.`) : [[`${prefix}${k}`, String(v)] as [string, string]]));
}

const HU = new Map(flat(read("hu")));
const EN = new Map(flat(read("en")));

// azonos HU/EN szöveg csak márkanév, rendszer-/platformnév vagy csupa helyőrző/írásjel lehet
const SAME_OK = /^(\{[a-zA-Z]+\}|[\s/·—–:.,()%+|-])*$|^(Bank Reminder|Service worker|Magyar|English|Push|Link|Internet|HTTPS)$|^(Android|iPhone|macOS|Windows)\b/;

describe("microcopy (HU + EN)", () => {
  it("nincs vezető/záró szóköz, dupla szóköz, ASCII „...” (a „…” kell), „ .” ", () => {
    const bad: string[] = [];
    for (const [lang, map] of [["hu", HU], ["en", EN]] as const) {
      for (const [k, v] of map) {
        if (v !== v.trim()) bad.push(`${lang}:${k} szóköz a szélén`);
        if (/ {2,}/.test(v)) bad.push(`${lang}:${k} dupla szóköz`);
        if (v.includes("...")) bad.push(`${lang}:${k} ASCII-három pont`);
        if (/ \.($|\s)/.test(v)) bad.push(`${lang}:${k} szóköz a pont előtt`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("az angol szövegben nincs magyar ékezetes betű, a magyarban nincsenek angol töltelékszavak", () => {
    const bad: string[] = [];
    for (const [k, v] of EN) if (/[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/.test(v)) bad.push(`en:${k} magyar betű: ${v.slice(0, 50)}`);
    for (const [k, v] of HU) if (/\b(the|and|your|please|loading|error)\b/i.test(v)) bad.push(`hu:${k} angol szó: ${v.slice(0, 50)}`);
    expect(bad).toEqual([]);
  });

  it("nincs lefordítatlan (a két nyelven azonos) hosszabb szöveg", () => {
    const bad: string[] = [];
    for (const [k, v] of HU) if (v === EN.get(k) && !SAME_OK.test(v)) bad.push(`${k}: ${v.slice(0, 50)}`);
    expect(bad).toEqual([]);
  });

  it("a helyőrzők (ICU-változók) a két nyelven azonosak (kivéve a többes szám ágaiban)", () => {
    // csak a legfelső szintű változók: a többes szám / select ágainak belsejében lévő szavak nem változók
    const vars = (s: string) => {
      const out = new Set<string>();
      for (let i = 0, depth = 0; i < s.length; i++) {
        if (s[i] === "{") {
          if (depth === 0) out.add(/^\w+/.exec(s.slice(i + 1))?.[0] ?? "");
          depth++;
        } else if (s[i] === "}") depth--;
      }
      return [...out].sort();
    };
    const bad: string[] = [];
    for (const [k, v] of HU) {
      const e = EN.get(k);
      if (e !== undefined && JSON.stringify(vars(v)) !== JSON.stringify(vars(e))) bad.push(`${k}: hu=${vars(v)} en=${vars(e)}`);
    }
    expect(bad).toEqual([]);
  });

  it("a hangnem: nincs csupa nagybetűs kiáltás (a „TÖRLÖM”/„DELETE” megerősítő szó kivételével) és nincs felkiáltójel-halmozás", () => {
    const bad: string[] = [];
    for (const [lang, map] of [["hu", HU], ["en", EN]] as const) {
      for (const [k, v] of map) {
        const words = v.replace(/\{[^}]*\}/g, "").match(/\p{Lu}{5,}/gu) ?? [];
        if (words.some((w) => !["TÖRLÖM", "DELETE", "TERVEZET", "DRAFT", "HTTPS"].includes(w))) bad.push(`${lang}:${k} csupa nagybetű: ${v.slice(0, 50)}`);
        if (/!{2,}/.test(v)) bad.push(`${lang}:${k} felkiáltójel-halmozás`);
      }
    }
    expect(bad).toEqual([]);
  });
});
