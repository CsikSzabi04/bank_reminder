import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { NameForm } from "@/components/profile/name-form";
import { SecuritySection } from "@/components/profile/security-section";
import { isProfileSection, ProfileNav, type ProfileSection } from "@/components/profile/profile-nav";
import { LanguageSwitch } from "@/components/shell/language-switch";
import { ThemeSwitch } from "@/components/shell/theme-switch";
import { avatarUrl } from "@/lib/avatar";
import { formatDate, formatMoney, todayIn } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getCurrentProfile, type CurrentProfile } from "@/lib/profile/queries";
import { first } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/server";
import type { DashboardSummary } from "@/types/rpc";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile");
  return { title: t("title") };
}

const CARD = "rounded-card border border-border bg-surface p-5 shadow-card";

// A fő kiadás-összeget az SQL számolja (dashboard_summary, H9); itt csak formázunk
async function loadStats(profile: CurrentProfile) {
  const supabase = createClient(await cookies());
  const monthStart = `${todayIn(profile.timezone).slice(0, 8)}01`;
  const [reminders, summary] = await Promise.all([
    supabase.from("reminders").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.rpc("dashboard_summary", { p_month: monthStart }),
  ]);
  const hero = (summary.data as unknown as DashboardSummary | null)?.hero ?? null;
  return { activeReminders: reminders.count, monthTotal: hero?.total ?? null };
}

async function Overview({ profile, locale }: { profile: CurrentProfile; locale: Locale }) {
  const t = await getTranslations("profile.overview");
  const td = await getTranslations("dashboard");
  const stats = await loadStats(profile);

  return (
    <div className="flex flex-col gap-4">
      <section className={CARD}>
        <h2 className="mb-4 text-lg font-semibold">{t("avatar.label")}</h2>
        <AvatarUploader userId={profile.id} name={profile.display_name} initialUrl={avatarUrl(profile.avatar_path)} />
      </section>

      <section className={cn(CARD, "flex flex-col gap-5")}>
        <NameForm initialName={profile.display_name ?? ""} />
        <dl className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-text-2">{t("email")}</dt>
            <dd className="break-all font-medium">{profile.email}</dd>
          </div>
          <div>
            <dt className="text-sm text-text-2">{t("memberSince")}</dt>
            <dd className="font-medium">{formatDate(profile.created_at, locale, profile.timezone)}</dd>
          </div>
          {stats.activeReminders !== null && (
            <div>
              <dt className="text-sm text-text-2">{t("stats.activeReminders")}</dt>
              <dd className="font-medium tabular-nums">{stats.activeReminders}</dd>
            </div>
          )}
          {stats.monthTotal !== null && (
            <div>
              <dt className="text-sm text-text-2">{td("monthTotal")}</dt>
              <dd className="font-medium tabular-nums">{formatMoney(stats.monthTotal, profile.base_currency, locale)}</dd>
            </div>
          )}
        </dl>
      </section>
    </div>
  );
}

async function Appearance() {
  const t = await getTranslations("profile.appearance");
  return (
    <section className={cn(CARD, "flex flex-col gap-4")}>
      <h2 className="text-lg font-semibold">{t("title")}</h2>
      <div className="flex flex-wrap gap-3">
        <ThemeSwitch />
        <LanguageSwitch />
      </div>
      <p className="text-sm text-text-2">{t("hint")}</p>
    </section>
  );
}

export default async function ProfilePage(props: PageProps<"/profile">) {
  const t = await getTranslations("profile");
  const locale = (await getLocale()) as Locale;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=%2Fprofile");

  const requested = first((await props.searchParams).section);
  const hasSection = isProfileSection(requested);
  const current: ProfileSection = hasSection ? requested : "overview";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <div className="md:grid md:grid-cols-[220px_1fr] md:items-start md:gap-8">
        {/* mobilon: szakasz nélkül lista, szakasszal a részlet; asztalon mindkettő látszik */}
        <ProfileNav current={current} className={hasSection ? "hidden md:block" : "block"} />
        <div className={hasSection ? "block" : "hidden md:block"}>
          <Link href="/profile" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary-text md:hidden">
            <ChevronLeft className="size-4" aria-hidden />
            {t("back")}
          </Link>
          {current === "overview" && <Overview profile={profile} locale={locale} />}
          {current === "appearance" && <Appearance />}
          {current === "security" && <SecuritySection />}
        </div>
      </div>
    </div>
  );
}
