import { describe, expect, it } from "vitest";
import { checkParity, checkUsage, extractUsedKeys, flatten, icuArgs } from "../../scripts/i18n-check.mjs";
import en from "@/locales/en.json";
import hu from "@/locales/hu.json";

describe("i18n:check logika", () => {
  it("a valódi hu/en fájlok egyeznek", () => {
    expect(checkParity(flatten(hu), flatten(en))).toEqual([]);
  });

  it("hiányzó EN kulcsra bukik", () => {
    const errors = checkParity({ "a.b": "x", "a.c": "y" }, { "a.b": "x" });
    expect(errors).toEqual(["EN-ből hiányzik: a.c"]);
  });

  it("hiányzó HU kulcsra és üres értékre bukik", () => {
    expect(checkParity({ a: "x" }, { a: "x", b: "y" })).toEqual(["HU-ból hiányzik: b"]);
    expect(checkParity({ a: "x" }, { a: " " })).toEqual(["EN: üres érték: a"]);
  });

  it("eltérő ICU-argumentumra bukik, plural ágak nem számítanak", () => {
    expect(checkParity({ a: "Szia {name}" }, { a: "Hi {nam}" })).toHaveLength(1);
    expect(
      checkParity(
        { a: "{n, plural, one {# nap} other {# nap}}" },
        { a: "{n, plural, one {# day} other {# days}}" },
      ),
    ).toEqual([]);
    expect(icuArgs("{amount} maradt, {n, plural, one {#} other {#}}")).toEqual(["amount", "n"]);
  });

  it("a plural-ágak puszta szava (one {havonta}) nem argumentum; a beágyazott argumentum igen", () => {
    expect(icuArgs("{n, plural, one {havonta} other {# havonta}}")).toEqual(["n"]);
    expect(icuArgs("{n, plural, one {monthly} other {every # months}}")).toEqual(["n"]);
    expect(icuArgs("{count, plural, one {{name} marad} other {# tétel}}")).toEqual(["count", "name"]);
    expect(icuArgs("{day, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}")).toEqual(["day"]);
    expect(icuArgs("Szia {name}! <b>{n}</b>")).toEqual(["n", "name"]);
  });

  it("használt kulcsot a névtérrel együtt oldja fel", () => {
    const src = `const t = useTranslations("nav");\nt("home"); t('more'); t(item.key);`;
    expect(extractUsedKeys(src)).toEqual([{ key: "nav.home" }, { key: "nav.more" }]);
    const root = `const t = await getTranslations();\nt("nav.skipToContent")`;
    expect(extractUsedKeys(root)).toEqual([{ key: "nav.skipToContent" }]);
  });

  it("több fordító-változót külön névtérrel kezel", () => {
    const src = `const t = useTranslations("nav");\nconst c = useTranslations("common");\nt("home"); c("save");`;
    expect(extractUsedKeys(src)).toEqual([{ key: "nav.home" }, { key: "common.save" }]);
  });

  it("ugyanaz a változónév más névtérrel külön függvényben: a legközelebbi megelőző deklaráció számít", () => {
    const src = [
      'async function a() { const t = await getTranslations("auth.checkEmail"); return t("title"); }',
      'async function b() { const t = await getTranslations("auth"); return t("tagline"); }',
    ].join(" ");
    expect(extractUsedKeys(src)).toEqual([{ key: "auth.checkEmail.title" }, { key: "auth.tagline" }]);
  });

  it("dinamikus kulcsnál az előtagot ellenőrzi", () => {
    const used = extractUsedKeys("const t = useTranslations();\nt(`nav.${key}`)");
    expect(used).toEqual([{ prefix: "nav." }]);
    expect(checkUsage([["f.tsx", used]], ["nav.home"])).toEqual([]);
    expect(checkUsage([["f.tsx", used]], ["common.save"])).toHaveLength(1);
  });

  it("használt, de hiányzó kulcsra bukik", () => {
    const used = extractUsedKeys(`const t = useTranslations("nav");\nt("nincsIlyen")`);
    expect(checkUsage([["f.tsx", used]], ["nav.home"])).toEqual([
      "f.tsx: használt, de hiányzó kulcs: nav.nincsIlyen",
    ]);
  });
});
