import { Search } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FILTERS, type Filter, type Sort } from "@/lib/reminders/group";
import { listHref } from "@/lib/reminders/list-url";
import { cn } from "@/lib/utils";
import { SortSelect } from "./sort-select";

// Keresés (GET űrlap: JS nélkül is működik) + szűrő-chipek (linkek) + rendezés. Az állapot az URL-ben él.
export async function ListToolbar({ filter, sort, q }: { filter: Filter; sort: Sort; q: string }) {
  const t = await getTranslations("reminders.list");
  return (
    <div className="flex flex-col gap-3">
      <form action="/reminders" method="get" role="search" className="flex gap-2">
        {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
        {sort !== "due" && <input type="hidden" name="sort" value={sort} />}
        <label className="relative flex-1">
          <span className="sr-only">{t("search")}</span>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder={t("searchPlaceholder")}
            autoComplete="off"
            className="min-h-12 w-full rounded-control border border-border bg-surface-2 pr-4 pl-10 text-text placeholder:text-text-muted"
          />
        </label>
        <button type="submit" className="min-h-12 rounded-control border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2">
          {t("search")}
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav aria-label={t("filterLabel")} className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f}
              href={listHref({ filter: f, sort, q })}
              aria-current={f === filter ? "true" : undefined}
              className={cn(
                "flex min-h-11 items-center rounded-full border px-4 text-sm font-medium",
                f === filter ? "border-primary bg-primary-soft text-primary-text" : "border-border bg-surface text-text-2 hover:bg-surface-2",
              )}
            >
              {t(`filter.${f}`)}
            </Link>
          ))}
        </nav>
        <SortSelect filter={filter} sort={sort} q={q} />
      </div>
    </div>
  );
}
