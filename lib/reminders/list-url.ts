import type { Filter, Sort } from "./group";

// A lista állapota az URL-ben él (megosztható, frissítés-biztos). Az alapértékek nem kerülnek bele.
export function listHref({ filter = "all", sort = "due", q = "" }: { filter?: Filter; sort?: Sort; q?: string }): string {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  if (sort !== "due") params.set("sort", sort);
  if (q.trim()) params.set("q", q.trim());
  const qs = params.toString();
  return qs ? `/reminders?${qs}` : "/reminders";
}
