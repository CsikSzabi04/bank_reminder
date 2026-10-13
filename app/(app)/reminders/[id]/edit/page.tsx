import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { ReminderForm } from "@/components/reminders/form/reminder-form";
import { todayIn } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getCurrentProfile } from "@/lib/profile/queries";
import { getFormReference, getReminderForEdit } from "@/lib/reminders/form-data";
import { valuesFromReminder } from "@/lib/reminders/form-values";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reminders.form");
  return { title: t("titleEdit") };
}

export default async function EditReminderPage(props: PageProps<"/reminders/[id]/edit">) {
  const t = await getTranslations("reminders.form");
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();

  const locale = (await getLocale()) as Locale;
  const profile = await getCurrentProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent(`/reminders/${id}/edit`)}`);

  // az RLS miatt idegen azonosítóra nincs találat → 404 (nem árulja el, hogy létezik-e)
  const [reminder, reference] = await Promise.all([getReminderForEdit(id), getFormReference(locale, profile.id)]);
  if (!reminder) notFound();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("titleEdit")}</h1>
      <ReminderForm
        reminderId={id}
        initial={valuesFromReminder(reminder)}
        categories={reference.categories}
        catalog={reference.catalog}
        today={todayIn(reference.timezone)}
        cancelHref={`/reminders/${id}`}
      />
    </div>
  );
}
