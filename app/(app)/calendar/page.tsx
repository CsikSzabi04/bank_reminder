import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { CalendarFeed } from "@/components/calendar/calendar-feed";
import { MonthSwitcher } from "@/components/dashboard/month-switcher";
import { BillList, BillRow } from "@/components/reminders/bill-row";
import { OccurrencePayButton } from "@/components/reminders/occurrence-pay-button";
import { categoryColorVar } from "@/lib/category-icons";
import { monthGrid } from "@/lib/calendar";
import { resolveMonth, shiftMonth } from "@/lib/dashboard";
import { formatDate, todayIn } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getCurrentProfile } from "@/lib/profile/queries";
import { getCategories } from "@/lib/reminders/queries";
import { first } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("calendar");
  return { title: t("title") };
}

const MAX_DOTS = 3;

export default async function CalendarPage(props: PageProps<"/calendar">) {
  const t = await getTranslations("calendar");
  const locale = (await getLocale()) as Locale;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=%2Fcalendar");

  const params = await props.searchParams;
  const today = todayIn(profile.timezone);
  const currentMonth = `${today.slice(0, 7)}-01`;
  const month = resolveMonth(first(params.month), today);
  const nextMonth = shiftMonth(month, 1);

  const supabase = createClient(await cookies());
  const [occ, categories, tokenRow] = await Promise.all([
    supabase
      .from("v_occurrences")
      .select("id, reminder_id, reminder_name, due_date, amount, currency, status, category_id")
      .gte("due_date", month)
      .lt("due_date", nextMonth)
      .order("due_date"),
    getCategories(locale),
    supabase.from("profiles").select("ics_token").eq("id", profile.id).single(),
  ]);

  const byDay = new Map<string, NonNullable<typeof occ.data>>();
  for (const o of occ.data ?? []) {
    if (!o.due_date) continue;
    byDay.set(o.due_date, [...(byDay.get(o.due_date) ?? []), o]);
  }

  // a kiválasztott nap: ?day= (a megjelenített hónapban), különben ma / a hónap első napja
  const dayParam = first(params.day);
  const selected = dayParam && dayParam.startsWith(month.slice(0, 7)) && /^\d{4}-\d{2}-\d{2}$/.test(dayParam)
    ? dayParam
    : today.startsWith(month.slice(0, 7)) ? today : month;
  const dayItems = byDay.get(selected) ?? [];

  const monthQuery = month === currentMonth ? "" : `month=${month.slice(0, 7)}&`;
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale === "hu" ? "hu-HU" : "en-GB", { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, 5, 1 + i))),
  );

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const feedPath = tokenRow.data ? `/api/ics/${tokenRow.data.ics_token}.ics` : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <MonthSwitcher month={month} currentMonth={currentMonth} locale={locale} basePath="/calendar" />
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-7">
          <section aria-label={t("grid")} className="rounded-card border border-border bg-surface p-3 shadow-card sm:p-4">
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-text-2" aria-hidden>
              {weekdays.map((w) => (
                <span key={w} className="py-1">{w}</span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {monthGrid(month).flat().map((day, i) => {
                if (!day) return <span key={`pad-${i}`} />;
                const items = byDay.get(day) ?? [];
                const colors = [...new Set(items.map((o) => categoryColorVar(o.category_id ? categories.get(o.category_id)?.colorSlot : 9)))];
                const isSelected = day === selected;
                const label = `${formatDate(day, locale, "UTC")}, ${t("dayLabel", { date: "", count: items.length }).replace(/^,\s*/, "")}`;
                return (
                  <Link
                    key={day}
                    href={`/calendar?${monthQuery}day=${day}`}
                    aria-label={label}
                    aria-current={day === today ? "date" : undefined}
                    className={cn(
                      "flex min-h-12 flex-col items-center justify-center gap-1 rounded-control border text-sm tabular-nums",
                      isSelected ? "border-primary bg-primary-soft text-primary-text" : "border-transparent hover:bg-surface-2",
                      day === today && !isSelected && "border-border font-semibold",
                    )}
                  >
                    <span>{Number(day.slice(8))}</span>
                    <span className="flex h-2 items-center gap-0.5" aria-hidden>
                      {colors.slice(0, MAX_DOTS).map((c) => (
                        <span key={c} className="size-1.5 rounded-full" style={{ background: c }} />
                      ))}
                      {items.length > MAX_DOTS && <span className="text-[9px] leading-none">{"+"}</span>}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

          <section aria-live="polite" className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">{formatDate(selected, locale, "UTC")}</h2>
            {dayItems.length === 0 ? (
              <p className="text-text-2">{t("noItems")}</p>
            ) : (
              <BillList label={formatDate(selected, locale, "UTC")}>
                {dayItems.map((o) => (
                  <BillRow
                    key={o.id}
                    href={`/reminders/${o.reminder_id}`}
                    name={o.reminder_name ?? ""}
                    amount={o.amount ?? 0}
                    currency={o.currency ?? profile.base_currency}
                    dueDate={o.due_date!}
                    today={today}
                    status={o.status ?? "upcoming"}
                    category={o.category_id ? categories.get(o.category_id) : null}
                    action={o.status === "upcoming" && o.id ? <OccurrencePayButton occurrenceId={o.id} name={o.reminder_name ?? ""} /> : undefined}
                  />
                ))}
              </BillList>
            )}
          </section>
        </div>

        <div className="min-w-0 lg:col-span-5">
          {feedPath && <CalendarFeed url={`${origin}${feedPath}`} webcal={`webcal://${h.get("host")}${feedPath}`} />}
        </div>
      </div>
    </div>
  );
}
