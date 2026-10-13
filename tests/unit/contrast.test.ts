import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// A valódi app/globals.css tokenjeit olvassuk, nem egy másolatot (B-06, §14.2)
const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

type Tokens = Record<string, string>;

function parseVars(block: string): Tokens {
  const out: Tokens = {};
  for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2].toLowerCase();
  return out;
}

function parseTokens(): { light: Tokens; dark: Tokens } {
  const light = parseVars(css.match(/:root\s*\{([^}]*)\}/)![1]);
  const darkOverrides = parseVars(css.match(/\.dark\s*\{([^}]*)\}/)![1]);
  // a sötét mód csak felülírja a világosat (pl. a --success/--warning/--danger közös)
  return { light, dark: { ...light, ...darkOverrides } };
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

type Pair = { fg: string; bg: string; min: number };

const SURFACES = ["bg", "surface", "surface-2"];
const TEXT_ON_SURFACES = ["text", "text-2", "text-muted", "success-text", "warning-text", "danger-text"];

const PAIRS: Pair[] = [
  // szöveg a felületeken: ≥ 4.5:1
  ...TEXT_ON_SURFACES.flatMap((fg) => SURFACES.map((bg) => ({ fg, bg, min: 4.5 }))),
  // márka: gomb-szöveg, aktív fül-szöveg (halvány háttéren), link/ikon
  { fg: "primary-fg", bg: "primary", min: 4.5 },
  { fg: "primary-text", bg: "primary-soft", min: 4.5 },
  ...SURFACES.map((bg) => ({ fg: "primary-text", bg, min: 4.5 })),
  { fg: "primary", bg: "bg", min: 4.5 },
  { fg: "primary", bg: "surface", min: 4.5 },
  // fókusz-kontúr (nem szöveg): ≥ 3:1 a felületeken (WCAG 1.4.11)
  ...SURFACES.map((bg) => ({ fg: "primary", bg, min: 3 })),
  // hőtérkép-lépcsők (C6): a szám olvasható marad minden lépcsőn
  ...[1, 2, 3, 4].map((n) => ({ fg: `heat-${n}-fg`, bg: `heat-${n}`, min: 4.5 })),
];

function failures(tokens: Tokens): string[] {
  return PAIRS.flatMap(({ fg, bg, min }) => {
    const ratio = contrast(tokens[fg], tokens[bg]);
    return ratio >= min ? [] : [`${fg} (${tokens[fg]}) / ${bg} (${tokens[bg]}) = ${ratio.toFixed(2)} < ${min}`];
  });
}

describe("token-kontraszt (B-06)", () => {
  const { light, dark } = parseTokens();

  it("minden szükséges token megvan mindkét módban", () => {
    for (const t of [light, dark]) {
      for (const name of new Set(PAIRS.flatMap((p) => [p.fg, p.bg]))) expect(t[name], name).toBeTruthy();
    }
  });

  it("világos mód: minden pár megfelel", () => {
    expect(failures(light)).toEqual([]);
  });

  it("sötét mód: minden pár megfelel", () => {
    expect(failures(dark)).toEqual([]);
  });

  it("a számítás helyes (fehér/fekete = 21:1)", () => {
    expect(contrast("#ffffff", "#000000")).toBeCloseTo(21, 5);
  });

  it("mutáció: rossz (túl halvány) szín esetén a teszt valóban bukik", () => {
    expect(failures({ ...light, "text-muted": "#a8b3c2" }).length).toBeGreaterThan(0);
    expect(failures({ ...dark, "text-2": "#3a4452" }).length).toBeGreaterThan(0);
    expect(failures({ ...light, "primary-fg": "#9ad9d0" }).length).toBeGreaterThan(0);
  });
});
