import { describe, expect, it } from "vitest";
import { collapseToOther, donutArcs } from "@/lib/charts/donut";

const opts = { size: 200, thickness: 40 };

describe("donutArcs", () => {
  it("üres, nulla és negatív bemenetre üres lista (nincs osztás nullával)", () => {
    expect(donutArcs([], opts)).toEqual([]);
    expect(donutArcs([{ key: "a", value: 0 }], opts)).toEqual([]);
    expect(donutArcs([{ key: "a", value: -5 }], opts)).toEqual([]);
  });

  it("a szeletek arányai összege 1, az arány az érték/összeg", () => {
    const arcs = donutArcs([{ key: "a", value: 30 }, { key: "b", value: 70 }], opts);
    expect(arcs.map((a) => a.key)).toEqual(["a", "b"]);
    expect(arcs.map((a) => a.share)).toEqual([0.3, 0.7]);
    expect(arcs.reduce((s, a) => s + a.share, 0)).toBeCloseTo(1, 10);
  });

  it("a nulla értékű szelet kimarad", () => {
    const arcs = donutArcs([{ key: "a", value: 10 }, { key: "z", value: 0 }, { key: "b", value: 10 }], opts);
    expect(arcs.map((a) => a.key)).toEqual(["a", "b"]);
  });

  it("egyetlen szelet teljes gyűrű (két külön kör-ív, nem elfajuló 360°-os ív)", () => {
    const [arc] = donutArcs([{ key: "a", value: 5 }], opts);
    expect(arc.share).toBe(1);
    expect(arc.path.match(/A/g)?.length).toBe(4); // külső + belső kör, 2-2 ív
    expect(arc.path).not.toContain("NaN");
  });

  it("az ívek érvényes SVG path-ok (nincs NaN), és a kezdőpont 12 óránál van", () => {
    const arcs = donutArcs([{ key: "a", value: 1 }, { key: "b", value: 2 }, { key: "c", value: 3 }], { ...opts, gap: 0 });
    for (const a of arcs) expect(a.path).not.toMatch(/NaN|Infinity/);
    expect(arcs[0].path.startsWith("M100 0")).toBe(true); // gap nélkül az első szelet a kör tetejéről indul
  });

  it(">50%-os szelet a nagy ív jelzőt (large-arc) kapja", () => {
    const [big, small] = donutArcs([{ key: "a", value: 80 }, { key: "b", value: 20 }], opts);
    expect(big.path).toMatch(/A100 100 0 1 1/);
    expect(small.path).toMatch(/A100 100 0 0 1/);
  });

  it("apró szelet a nagy rés miatt sem tűnik el vagy fordul meg (az ív a kezdőpontja UTÁN ér véget)", () => {
    const arcs = donutArcs([{ key: "a", value: 1 }, { key: "b", value: 100000 }], { ...opts, gap: 0.5 });
    expect(arcs).toHaveLength(2);
    // az első ív külső kezdő- és végpontja → szög a középpontból (0 = fent, óramutató szerint)
    const m = arcs[0].path.match(/^M([\d.-]+) ([\d.-]+)A[\d.]+ [\d.]+ 0 [01] 1 ([\d.-]+) ([\d.-]+)/)!;
    const angle = (x: number, y: number) => (Math.atan2(x - 100, -(y - 100)) + 2 * Math.PI) % (2 * Math.PI);
    const start = angle(Number(m[1]), Number(m[2]));
    const end = angle(Number(m[3]), Number(m[4]));
    expect((end - start + 2 * Math.PI) % (2 * Math.PI)).toBeLessThan(0.01); // nem fordult át a teljes körön
    for (const a of arcs) expect(a.path).not.toMatch(/NaN/);
  });
});

describe("collapseToOther (diagramonként max. 7 csoport + Egyéb)", () => {
  const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ key: `g${i}`, value: 100 - i }));
  const other = (value: number) => ({ key: "other", value });

  it("kevés elemnél nem változtat, csak rendez és a nullát eldobja", () => {
    expect(collapseToOther([{ key: "a", value: 1 }, { key: "b", value: 5 }, { key: "z", value: 0 }], 7, "other", other)).toEqual([
      { key: "b", value: 5 },
      { key: "a", value: 1 },
    ]);
  });

  it("a felesleg az „Egyéb”-be olvad, az összeg megmarad", () => {
    const out = collapseToOther(mk(10), 7, "other", other);
    expect(out).toHaveLength(8);
    expect(out[7].key).toBe("other");
    expect(out.reduce((s, i) => s + i.value, 0)).toBe(mk(10).reduce((s, i) => s + i.value, 0));
  });

  it("ha az „Egyéb” már a fő szeletek között van, ahhoz adódik", () => {
    const items = [...mk(8), { key: "other", value: 99.5 }];
    const out = collapseToOther(items, 7, "other", other);
    expect(out.filter((i) => i.key === "other")).toHaveLength(1);
    expect(out.reduce((s, i) => s + i.value, 0)).toBeCloseTo(items.reduce((s, i) => s + i.value, 0), 8);
  });
});
