"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { SORTS, isSort, type Filter, type Sort } from "@/lib/reminders/group";
import { listHref } from "@/lib/reminders/list-url";

export function SortSelect({ filter, sort, q }: { filter: Filter; sort: Sort; q: string }) {
  const t = useTranslations("reminders.list");
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm text-text-2">
      {t("sort.label")}
      <select
        value={sort}
        onChange={(e) => isSort(e.target.value) && router.replace(listHref({ filter, sort: e.target.value, q }))}
        className="min-h-11 rounded-control border border-border bg-surface px-3 text-text"
      >
        {SORTS.map((s) => (
          <option key={s} value={s}>
            {t(`sort.${s}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
