import { shiftMonth } from "@/lib/dashboard";
import { addDays } from "@/lib/tz";

// Az /analytics időszak-chipjei (§15.1). Az időszak a kiválasztott hónapban ér véget.
export const RANGES = ["month", "3m", "6m", "12m", "ytd"] as const;
export type Range = (typeof RANGES)[number];

export function resolveRange(param: string | undefined): Range {
  return (RANGES as readonly string[]).includes(param ?? "") ? (param as Range) : "month";
}

// [from, to] zárt napi tartomány: a to a kiválasztott hónap utolsó napja
export function rangeWindow(range: Range, month: string): { from: string; to: string } {
  const to = addDays(shiftMonth(month, 1), -1);
  switch (range) {
    case "month":
      return { from: month, to };
    case "3m":
      return { from: shiftMonth(month, -2), to };
    case "6m":
      return { from: shiftMonth(month, -5), to };
    case "12m":
      return { from: shiftMonth(month, -11), to };
    case "ytd":
      return { from: `${month.slice(0, 4)}-01-01`, to };
  }
}

// Hány hónapot mutat a trend (C2/C5): az aktuális hónappal záródik (az SQL ezt rögzíti); idénre az év eleje óta, legalább 3
export function trendMonths(range: Range, currentMonth: string): number {
  if (range === "12m") return 12;
  if (range === "ytd") return Math.max(3, Number(currentMonth.slice(5, 7)));
  return 6;
}
