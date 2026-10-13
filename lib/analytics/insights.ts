// Meglátások (§15.6): determinisztikus `code + params` párok; a mondatot a `locales` adja (nyelvváltás azonnal hat).
// A kiadás-összegeket az SQL számolta; itt csak arányt képzünk a szöveghez.
export type Insight =
  | { code: "deltaUp" | "deltaDown"; pct: number }
  | { code: "topItem"; name: string; amount: number }
  | { code: "subsShare"; pct: number }
  | { code: "frontLoaded"; pct: number };

export type InsightInput = {
  /** a hero változása az előző hónaphoz (százalék, pl. 8 = +8%); null, ha nincs alap */
  deltaPct: number | null;
  top: { name: string; total: number } | null;
  /** előfizetések havi egyenértéke + a hónap összes kiadása */
  subsMonthly: number;
  monthTotal: number;
  /** a hónap kumulatív napi értékei (index 0 = 1. nap) */
  cumulative: readonly number[];
};

const FRONT_LOADED_DAYS = 10;
const FRONT_LOADED_MIN = 0.6;

export function buildInsights(i: InsightInput): Insight[] {
  const out: Insight[] = [];
  if (i.deltaPct !== null && i.deltaPct !== 0) {
    out.push({ code: i.deltaPct > 0 ? "deltaUp" : "deltaDown", pct: Math.abs(i.deltaPct) / 100 });
  }
  if (i.top && i.top.total > 0) out.push({ code: "topItem", name: i.top.name, amount: i.top.total });
  if (i.monthTotal > 0 && i.subsMonthly > 0) {
    out.push({ code: "subsShare", pct: Math.min(1, i.subsMonthly / i.monthTotal) });
  }
  const total = i.cumulative[i.cumulative.length - 1] ?? 0;
  if (total > 0 && i.cumulative.length > FRONT_LOADED_DAYS) {
    const share = i.cumulative[FRONT_LOADED_DAYS - 1] / total;
    if (share >= FRONT_LOADED_MIN) out.push({ code: "frontLoaded", pct: share });
  }
  return out;
}
