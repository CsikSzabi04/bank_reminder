import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";

// A tippek szövege `kód + paraméterek` (H7: nincs generált szöveg): a mondatot a `locales` (tips.<kód>.title|body|why) adja.
// Itt a paramétereket formázzuk a mondatba (pénz, százalék, dátum, lista); az összegeket az SQL számolta.
export const TIP_CODES = [
  "sub_overlap_group",
  "sub_covered_by_others",
  "sub_maybe_redundant",
  "sub_annual_cheaper",
  "price_increase",
  "trial_ending",
  "subs_share_high",
  "unused_check",
  "sub_unused",
  "budget_over_now",
  "budget_forecast_over",
  "duplicate_reminder",
  "late_payment_pattern",
] as const;
export type TipCode = (typeof TIP_CODES)[number];

export const isTipCode = (code: string): code is TipCode => (TIP_CODES as readonly string[]).includes(code);

export type TipVars = Record<string, string | number>;

export type TipContext = {
  locale: Locale;
  /** az alap-pénznem, ha a paraméter nem hoz sajátot */
  currency: string;
  categoryName: (id: string) => string;
  usageLabel: (tag: string) => string;
  groupLabel: (group: string) => string;
};

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export function tipVars(code: TipCode, p: Record<string, unknown>, ctx: TipContext): TipVars {
  const cur = str(p.currency, ctx.currency);
  const money = (v: unknown) => formatMoney(num(v), cur, ctx.locale);
  const pct = (v: unknown) => formatPercent(num(v) / 100, ctx.locale);
  const list = (xs: string[]) => new Intl.ListFormat(ctx.locale === "hu" ? "hu" : "en", { style: "long", type: "conjunction" }).format(xs);

  switch (code) {
    case "sub_overlap_group":
      return { group: ctx.groupLabel(str(p.group)), count: num(p.count), names: list(strs(p.names)), total: money(p.monthly_total) };
    case "sub_covered_by_others":
      return { name: str(p.name), tags: list(strs(p.tags).map(ctx.usageLabel)), covered: list(strs(p.covered_by)) };
    case "sub_maybe_redundant":
      return { name: str(p.name), group: ctx.groupLabel(str(p.group)) };
    case "sub_annual_cheaper":
      return { name: str(p.name), pct: pct(p.pct), saving: money(p.yearly_saving) };
    case "price_increase":
      return { name: str(p.name), old: money(p.old), new: money(p.new), pct: pct(p.pct) };
    case "trial_ending":
      return { name: str(p.name), date: str(p.date) ? formatDate(str(p.date), ctx.locale, "UTC") : "", amount: money(p.amount_after) };
    case "subs_share_high":
      return { pct: pct(p.pct), monthly: money(p.monthly), yearly: money(p.yearly) };
    case "unused_check":
    case "sub_unused":
      return { name: str(p.name) };
    case "budget_over_now":
      return { category: ctx.categoryName(str(p.category_id)), over: money(p.over) };
    case "budget_forecast_over":
      return { category: ctx.categoryName(str(p.category_id)), forecast: money(p.forecast), limit: money(p.limit) };
    case "duplicate_reminder":
      return { a: str(p.a), b: str(p.b) };
    case "late_payment_pattern":
      return { name: str(p.name), count: num(p.count) };
  }
}
