import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { GoalForm } from "@/components/savings/goal-form";
import { addDays } from "@/lib/tz";
import { todayIn, formatMoney } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getCurrentProfile } from "@/lib/profile/queries";
import { PRESET_DEFAULTS, resolvePreset } from "@/lib/savings/icons";
import { getEmergencyTarget } from "@/lib/savings/queries";
import { first } from "@/lib/search-params";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("savings");
  return { title: t("newGoal") };
}

// Új cél; az előkészített cél (?preset=) kitölti a nevet, az ikont, a színt — a vészhelyzeti alapnál a javasolt összeget is
export default async function NewGoalPage(props: PageProps<"/savings/new">) {
  const t = await getTranslations("savings");
  const locale = (await getLocale()) as Locale;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=%2Fsavings%2Fnew");

  const preset = resolvePreset(first((await props.searchParams).preset));
  const defaults = PRESET_DEFAULTS[preset];
  const emergency = preset === "emergency" ? await getEmergencyTarget(profile.base_currency) : null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <Link href="/savings" className="flex min-h-11 w-fit items-center gap-1 text-sm font-medium text-primary-text">
        <ChevronLeft className="size-4" aria-hidden />
        {t("back")}
      </Link>
      <h1 className="text-2xl font-semibold">{t("newGoal")}</h1>
      {preset === "emergency" && (
        <p className="text-sm text-text-2">
          {emergency !== null ? t("emergencyHint", { amount: formatMoney(emergency, profile.base_currency, locale) }) : t("emergencyNoData")}
        </p>
      )}
      <div className="rounded-card border border-border bg-surface p-5 shadow-card">
        <GoalForm
          goalId={null}
          minDate={addDays(todayIn(profile.timezone), 1)}
          initial={{
            name: preset === "custom" ? "" : t(`presets.${preset}`),
            target: emergency !== null ? String(emergency) : "",
            targetDate: "",
            icon: defaults.icon,
            colorSlot: defaults.colorSlot,
            bankMatch: "",
          }}
        />
      </div>
    </div>
  );
}
