import type { Metadata } from "next";
import { ChevronLeft, Pencil, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { CategoryChip } from "@/components/categories/category-chip";
import { CategoryIcon } from "@/components/categories/category-icon";
import { DueLabel } from "@/components/reminders/due-label";
import { DetailMenu } from "@/components/reminders/detail-menu";
import { OccurrencePayButton } from "@/components/reminders/occurrence-pay-button";
import { RecurrenceText } from "@/components/reminders/recurrence-text";
import { AmountText } from "@/components/ui/amount-text";
import { formatDate, formatMoney, formatPercent, todayIn } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getCurrentProfile } from "@/lib/profile/queries";
import { getReminderDetail, nextOccurrence, type HistoryRow } from "@/lib/reminders/detail";
import { getCategories } from "@/lib/reminders/queries";

export async function generateMetadata(props: PageProps<"/reminders/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) return {};
  const { reminder } = await getReminderDetail(id);
  // hiányzó emlékeztetőnél ne írjuk felül az alap címet (undefined → üres <title>)
  return reminder ? { title: reminder.name } : {};
}

const CARD = "rounded-card border border-border bg-surface p-5 shadow-card";

export default async function ReminderDetailPage(props: PageProps<"/reminders/[id]">) {
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();

  const t = await getTranslations("reminders");
  const td = await getTranslations("reminders.detail");
  const tf = await getTranslations("reminders.form");
  const locale = (await getLocale()) as Locale;
  const profile = await getCurrentProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent(`/reminders/${id}`)}`);

  const [{ reminder, history }, categories] = await Promise.all([getReminderDetail(id), getCategories(locale)]);
  if (!reminder) notFound(); // az RLS miatt idegen azonosítóra sincs találat
  const today = todayIn(profile.timezone);
  const category = reminder.category_id ? categories.get(reminder.category_id) : undefined;
  const next = nextOccurrence(history);
  const upcoming = history.filter((h) => h.status === "upcoming").sort((a, b) => (a.due_date < b.due_date ? -1 : 1));
  const past = history.filter((h) => h.status !== "upcoming" || h.overdue);
  const offsets = [...reminder.remind_offsets].sort((a, b) => a - b);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Link href="/reminders" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary-text">
        <ChevronLeft className="size-4" aria-hidden />
        {td("back")}
      </Link>

      <section className={CARD}>
        <div className="flex items-start gap-4">
          <CategoryIcon icon={category?.icon} colorSlot={category?.colorSlot} size={56} />
          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold">
              <span className="break-words">{reminder.name}</span>
              {reminder.is_demo && (
                <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary-text">{t("demoBadge")}</span>
              )}
              {!reminder.is_active && (
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-text-2">{td("paused")}</span>
              )}
            </h1>
            <p className="text-text-2">
              <RecurrenceText unit={reminder.recur_unit} every={reminder.recur_every} startDate={reminder.start_date} monthEnd={reminder.month_end} />
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-text-2">{td("next")}</p>
            <AmountText amount={next?.amount ?? reminder.amount} currency={next?.currency ?? reminder.currency} hero />
            <div className="mt-1">
              {next ? <DueLabel status="upcoming" dueDate={next.due_date} today={today} /> : <span className="text-sm text-text-2">{td("nothingDue")}</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {next && reminder.is_active && <OccurrencePayButton occurrenceId={next.occurrence_id} name={reminder.name} />}
            <Link
              href={`/reminders/${reminder.id}/edit`}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-control border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-2"
            >
              <Pencil className="size-4" aria-hidden />
              {td("edit")}
            </Link>
            <DetailMenu reminderId={reminder.id} occurrenceId={next?.occurrence_id ?? null} name={reminder.name} active={reminder.is_active} />
          </div>
        </div>
      </section>

      <section className={CARD} aria-labelledby="detail-meta">
        <h2 id="detail-meta" className="mb-3 text-lg font-semibold">
          {td("details")}
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          {category && (
            <div>
              <dt className="text-sm text-text-2">{td("category")}</dt>
              <dd className="mt-1"><CategoryChip category={category} /></dd>
            </div>
          )}
          <div>
            <dt className="text-sm text-text-2">{td("notify")}</dt>
            <dd className="font-medium">
              {reminder.remind_enabled
                ? `${offsets.map((n) => (n === 0 ? tf("sameDay") : tf("daysBefore", { n }))).join(", ")} · ${reminder.remind_time.slice(0, 5)}`
                : td("notifyDisabled")}
            </dd>
          </div>
          {reminder.trial_ends_on && (
            <div>
              <dt className="text-sm text-text-2">{td("trialEnds")}</dt>
              <dd className="font-medium">{formatDate(reminder.trial_ends_on, locale, profile.timezone)}</dd>
            </div>
          )}
          {reminder.auto_paid && (
            <div className="sm:col-span-2">
              <dd className="font-medium">{td("autoPaid")}</dd>
            </div>
          )}
          {reminder.url && (
            <div className="sm:col-span-2">
              <dt className="text-sm text-text-2">{td("link")}</dt>
              <dd className="break-all font-medium">
                <a href={reminder.url} target="_blank" rel="noopener noreferrer" className="text-primary-text underline">
                  {reminder.url}
                </a>
              </dd>
            </div>
          )}
          {reminder.note && (
            <div className="sm:col-span-2">
              <dt className="text-sm text-text-2">{td("note")}</dt>
              {/* szövegként renderelődik (nincs HTML), a sortöréseket megtartjuk */}
              <dd className="whitespace-pre-line">{reminder.note}</dd>
            </div>
          )}
        </dl>
      </section>

      {upcoming.length > 0 && (
        <section className={CARD} aria-labelledby="detail-upcoming">
          <h2 id="detail-upcoming" className="mb-3 text-lg font-semibold">
            {td("upcoming")}
          </h2>
          <ul className="divide-y divide-border">
            {upcoming.map((h) => (
              <HistoryItem key={h.occurrence_id} row={h} today={today} locale={locale} timeZone={profile.timezone} />
            ))}
          </ul>
        </section>
      )}

      <section className={CARD} aria-labelledby="detail-history">
        <h2 id="detail-history" className="mb-3 text-lg font-semibold">
          {td("history")}
        </h2>
        {past.length === 0 ? (
          <p className="text-text-2">{td("historyEmpty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {past.map((h) => (
              <HistoryItem key={h.occurrence_id} row={h} today={today} locale={locale} timeZone={profile.timezone} showChange />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

async function HistoryItem({
  row,
  today,
  locale,
  timeZone,
  showChange,
}: {
  row: HistoryRow;
  today: string;
  locale: Locale;
  timeZone: string;
  showChange?: boolean;
}) {
  const td = await getTranslations("reminders.detail");
  const change = row.change_pct;
  // az árváltozást az SQL számolja (reminder_history.change_pct); itt csak formázzuk (H9)
  const pct = change === null ? null : formatPercent(Math.abs(change) / 100, locale);
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">{formatDate(row.due_date, locale, timeZone)}</span>
        <DueLabel status={row.status} dueDate={row.due_date} today={today} hideFarDate />
        {row.status === "paid" && row.paid_on && (
          <span className="text-sm text-text-2">{td("paidOn", { date: formatDate(row.paid_on, locale, timeZone) })}</span>
        )}
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <AmountText amount={row.amount} currency={row.currency} className="font-medium" />
        {row.status === "paid" && row.paid_amount !== null && row.paid_amount !== row.amount && (
          <span className="text-sm text-text-2">{td("paidAmount", { amount: formatMoney(row.paid_amount, row.currency, locale) })}</span>
        )}
        {showChange && change !== null && change !== 0 && pct && (
          <span
            className={`inline-flex items-center gap-1 text-sm font-medium ${change > 0 ? "text-danger-text" : "text-success-text"}`}
          >
            {change > 0 ? <TrendingUp className="size-4" aria-hidden /> : <TrendingDown className="size-4" aria-hidden />}
            {change > 0 ? td("priceUp", { pct: `+${pct}` }) : td("priceDown", { pct: `−${pct}` })}
          </span>
        )}
      </div>
    </li>
  );
}
