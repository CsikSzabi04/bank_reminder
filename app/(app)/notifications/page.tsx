import type { Metadata } from "next";
import { BellOff } from "lucide-react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { MarkAllButton } from "@/components/notifications/mark-all-button";
import { NotificationItem } from "@/components/notifications/notification-item";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatMoney, formatTime, todayIn } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { describeNotification } from "@/lib/notification-text";
import { getReminderUrls } from "@/lib/reminders/queries";
import { getCurrentProfile } from "@/lib/profile/queries";
import { addDays } from "@/lib/tz";
import { createClient } from "@/utils/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notifications");
  return { title: t("title") };
}

export default async function NotificationsPage() {
  const t = await getTranslations("notifications");
  const locale = (await getLocale()) as Locale;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=%2Fnotifications");

  // az RLS csak a saját, már esedékes in-app sorokat adja (scheduled_for <= now())
  const { data } = await createClient(await cookies())
    .from("notifications")
    .select("id, kind, payload, scheduled_for, read_at, reminder_id, occurrence_id")
    .eq("channel", "in_app")
    .neq("status", "cancelled")
    .order("scheduled_for", { ascending: false })
    .limit(100);
  const rows = data ?? [];
  // a számla-értesítésekhez a „Megnyitás ↗" (az emlékeztető külső hivatkozása), egy lekérdezéssel
  const urls = await getReminderUrls(rows.flatMap((r) => (r.reminder_id ? [r.reminder_id] : [])));

  const tz = profile.timezone;
  const today = todayIn(tz);
  const yesterday = addDays(today, -1);
  const money = (n: number | undefined, c: string | undefined) => (n === undefined ? "" : formatMoney(n, c ?? profile.base_currency, locale));

  // napok szerint csoportosítva (a profil időzónájában)
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const day = todayIn(tz, new Date(r.scheduled_for));
    groups.set(day, [...(groups.get(day) ?? []), r]);
  }
  const hasUnread = rows.some((r) => r.read_at === null);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        {hasUnread && <MarkAllButton />}
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={BellOff} title={t("empty.title")} body={t("empty.body")} />
      ) : (
        [...groups.entries()].map(([day, items]) => {
          const heading = day === today ? t("today") : day === yesterday ? t("yesterday") : formatDate(day, locale, "UTC");
          return (
            <section key={day} aria-label={heading} className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-text-2">{heading}</h2>
              <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface shadow-card">
                {items.map((r) => {
                  const v = describeNotification(r, locale);
                  const values = {
                    name: v.values.name ?? "",
                    n: v.values.n ?? 0,
                    pct: v.values.pct ?? 0,
                    count: v.values.count ?? 0,
                    names: v.values.names ?? "",
                    amount: money(v.values.amount, v.values.currency),
                    total: money(v.values.total, v.values.currency),
                    date: v.values.date ? formatDate(v.values.date, locale, "UTC") : "",
                  };
                  return (
                    <NotificationItem
                      key={r.id}
                      id={r.id}
                      unread={r.read_at === null}
                      unreadLabel={t("unread")}
                      title={t(`text.${v.key}.title`, values)}
                      body={t(`text.${v.key}.body`, values)}
                      time={formatTime(r.scheduled_for, locale, tz)}
                      url={v.url}
                      externalUrl={r.reminder_id ? urls.get(r.reminder_id) : undefined}
                      externalName={v.values.name ?? ""}
                    />
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
