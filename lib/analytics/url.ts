import type { Range } from "./range";

export type AnalyticsView = "chart" | "table";

// Az /analytics állapota az URL-ben él (JS nélkül is működik); az alapértékek nem kerülnek bele
export function analyticsHref(state: { month: string; currentMonth: string; range: Range; view: AnalyticsView }): string {
  const q = new URLSearchParams();
  if (state.month !== state.currentMonth) q.set("month", state.month.slice(0, 7));
  if (state.range !== "month") q.set("range", state.range);
  if (state.view === "table") q.set("view", "table");
  const s = q.toString();
  return s ? `/analytics?${s}` : "/analytics";
}
