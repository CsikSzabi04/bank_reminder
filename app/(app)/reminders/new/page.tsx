import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ReminderForm } from "@/components/reminders/form/reminder-form";
import { todayIn } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getCurrentProfile } from "@/lib/profile/queries";
import { defaultValues } from "@/lib/reminders/form-values";
import { getFormReference } from "@/lib/reminders/form-data";
import { first } from "@/lib/search-params";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reminders.form");
  return { title: t("titleNew") };
}

const SUBSCRIPTION_CATEGORY_KEYS = new Set(["streaming", "music", "software", "gaming"]);

export default async function NewReminderPage(props: PageProps<"/reminders/new">) {
  const t = await getTranslations("reminders.form");
  const locale = (await getLocale()) as Locale;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=%2Freminders%2Fnew");

  const { categories, catalog, defaults, timezone } = await getFormReference(locale, profile.id);
  if (!defaults) redirect("/dashboard");
  const today = todayIn(timezone);
  const initial = defaultValues(today, defaults);

  // Előtöltés a gyors-hozzáadásból: ?service=<katalógus-slug> vagy ?name=…&category=<kulcs>
  const params = await props.searchParams;
  const fromOnboarding = first(params.onboarding) === "1";
  const service = catalog.find((c) => c.slug === first(params.service));
  const categoryKey = service?.categoryKey ?? first(params.category);
  const category = categories.find((c) => c.key === categoryKey);
  if (service) {
    initial.name = service.name;
    initial.serviceSlug = service.slug;
  } else {
    initial.name = (first(params.name) ?? "").slice(0, 80);
  }
  if (category) initial.categoryId = category.id;
  initial.isSubscription = categoryKey ? SUBSCRIPTION_CATEGORY_KEYS.has(categoryKey) : false;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("titleNew")}</h1>
      <ReminderForm
        initial={initial}
        categories={categories}
        catalog={catalog}
        today={today}
        cancelHref={fromOnboarding ? "/onboarding?step=2" : "/reminders"}
        fromOnboarding={fromOnboarding}
      />
    </div>
  );
}
