import type { Metadata } from "next";
import { Bell, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ClearDemoButton, LoadDemoButton } from "@/components/reminders/demo-buttons";
import { ListToolbar } from "@/components/reminders/list-toolbar";
import { ReminderRows } from "@/components/reminders/reminder-rows";
import { EmptyState } from "@/components/ui/empty-state";
import { todayIn } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getCurrentProfile } from "@/lib/profile/queries";
import { filterItems, GROUP_ORDER, groupItems, isFilter, isSort, sortItems } from "@/lib/reminders/group";
import { QUICK_ADD, quickAddHref } from "@/lib/reminders/quick-add";
import { getCategories, getReminderList } from "@/lib/reminders/queries";
import { first } from "@/lib/search-params";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reminders");
  return { title: t("title") };
}

// a display-t a használat adja (az `hidden md:inline-flex` ütközne egy beégetett inline-flex-szel)
const BTN_PRIMARY = "min-h-11 items-center gap-2 rounded-control bg-primary px-4 text-sm font-medium text-primary-fg";

export default async function RemindersPage(props: PageProps<"/reminders">) {
  const t = await getTranslations("reminders");
  const tl = await getTranslations("reminders.list");
  const locale = (await getLocale()) as Locale;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=%2Freminders");

  const params = await props.searchParams;
  const rawFilter = first(params.filter);
  const rawSort = first(params.sort);
  const filter = isFilter(rawFilter) ? rawFilter : "all";
  const sort = isSort(rawSort) ? rawSort : "due";
  const q = (first(params.q) ?? "").slice(0, 80);

  const [items, categories] = await Promise.all([getReminderList(), getCategories(locale)]);
  const today = todayIn(profile.timezone);

  // Még nincs emlékeztető: tanító üres állapot + gyors-hozzáadás + minta-adatok
  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <EmptyState icon={Bell} title={t("empty.title")} body={t("empty.body")}>
          <Link href="/reminders/new" className={`${BTN_PRIMARY} inline-flex`}>
            <Plus className="size-4" aria-hidden />
            {t("new")}
          </Link>
          <LoadDemoButton />
        </EmptyState>
        <section aria-labelledby="quick-add" className="flex flex-col gap-2">
          <h2 id="quick-add" className="text-sm font-medium text-text-2">
            {tl("quickAdd")}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {QUICK_ADD.map((item) => {
              const label = item.kind === "brand" ? item.name : t(`quickAdd.${item.labelKey}`);
              return (
                <li key={label}>
                  <Link
                    href={quickAddHref(item, label)}
                    className="flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2"
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="text-sm text-text-muted">{tl("loadDemoHint")}</p>
        </section>
      </div>
    );
  }

  const visible = sortItems(filterItems(items, { filter, q }, today), sort, locale);
  const groups = groupItems(visible, today);
  const hasDemo = items.some((i) => i.reminder.is_demo);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <Link href="/reminders/new" className={`${BTN_PRIMARY} hidden md:inline-flex`}>
          <Plus className="size-4" aria-hidden />
          {t("new")}
        </Link>
      </div>

      <ListToolbar filter={filter} sort={sort} q={q} />

      {visible.length === 0 ? (
        <EmptyState icon={Bell} title={tl("noResults")} body={tl("noResultsBody")} />
      ) : (
        GROUP_ORDER.filter((key) => groups[key].length > 0).map((key) => (
          <section key={key} aria-labelledby={`group-${key}`} className="flex flex-col gap-2">
            <h2
              id={`group-${key}`}
              className={`flex items-baseline gap-2 text-sm font-semibold ${key === "overdue" ? "text-danger-text" : "text-text-2"}`}
            >
              {tl(`groups.${key}`)}
              <span className="font-normal text-text-muted">{tl("count", { count: groups[key].length })}</span>
            </h2>
            <ReminderRows items={groups[key]} categories={categories} today={today} label={tl(`groups.${key}`)} />
          </section>
        ))
      )}

      {hasDemo && (
        <div className="flex justify-center pt-2">
          <ClearDemoButton />
        </div>
      )}
    </div>
  );
}
