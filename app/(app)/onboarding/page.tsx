import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BasicsForm } from "@/components/onboarding/basics-form";
import { Progress, SkipForm } from "@/components/onboarding/finish-buttons";
import { InstallButton } from "@/components/install/install-button";
import { PushPanel } from "@/components/push/push-panel";
import { getCurrentProfile } from "@/lib/profile/queries";
import { QUICK_ADD, quickAddHref } from "@/lib/reminders/quick-add";
import { first } from "@/lib/search-params";
import { createClient } from "@/utils/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding");
  return { title: t("title") };
}

const CARD = "flex flex-col gap-5 rounded-card border border-border bg-surface p-5 shadow-card";
const LINK_BTN = "flex min-h-12 items-center justify-center rounded-control border border-border bg-surface px-5 font-medium hover:bg-surface-2";

// Üdvözlő varázsló (§14.11, F-24): 3 lépés, bármikor kihagyható; a végén onboarding_done = true. Az állapot az URL-ben él (?step=).
export default async function OnboardingPage(props: PageProps<"/onboarding">) {
  const t = await getTranslations("onboarding");
  const tq = await getTranslations("reminders.quickAdd");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=%2Fonboarding");

  const supabase = createClient(await cookies());
  const { data: flags } = await supabase.from("profiles").select("onboarding_done, reminders_enabled").eq("id", profile.id).single();
  if (flags?.onboarding_done) redirect("/dashboard");

  const raw = Number(first((await props.searchParams).step));
  const step = raw === 2 || raw === 3 ? raw : 1;
  const name = profile.display_name || profile.email.split("@")[0];

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <Progress step={step} />

      {step === 1 && (
        <section aria-labelledby="ob-title" className={CARD}>
          <div>
            <h1 id="ob-title" className="text-2xl font-semibold">
              {t("welcome", { name })}
            </h1>
            <p className="mt-1 text-text-2">{t("welcomeBody")}</p>
          </div>
          <BasicsForm currency={profile.base_currency} timezone={profile.timezone} />
        </section>
      )}

      {step === 2 && (
        <section aria-labelledby="ob-title" className={CARD}>
          <div>
            <h1 id="ob-title" className="text-2xl font-semibold">
              {t("firstTitle")}
            </h1>
            <p className="mt-1 text-text-2">{t("firstBody")}</p>
          </div>
          <ul className="flex flex-wrap gap-2">
            {QUICK_ADD.map((item) => {
              const label = item.kind === "brand" ? item.name : tq(item.labelKey);
              return (
                <li key={item.kind === "brand" ? item.service : item.labelKey}>
                  <Link
                    href={`${quickAddHref(item, label)}&onboarding=1`}
                    className="flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2"
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link href="/onboarding?step=3" className={LINK_BTN}>
            {t("later")}
          </Link>
        </section>
      )}

      {step === 3 && (
        <section aria-labelledby="ob-title" className={CARD}>
          <div>
            <h1 id="ob-title" className="text-2xl font-semibold">
              {t("notifyTitle")}
            </h1>
            <p className="mt-1 text-text-2">{t("notifyBody")}</p>
          </div>
          <PushPanel vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null} devices={[]} globalEnabled={flags?.reminders_enabled ?? true} />
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <h2 className="text-lg font-semibold">{t("installTitle")}</h2>
            <p className="text-text-2">{t("installBody")}</p>
            <div className="flex flex-wrap gap-2">
              <InstallButton variant="button" />
              <Link href="/install" className="flex min-h-11 items-center px-3 text-sm font-medium text-primary-text">
                {t("installGuide")}
              </Link>
            </div>
          </div>
          <SkipForm label={t("done")} primary />
        </section>
      )}

      <div className="flex justify-center">
        <SkipForm label={t("skip")} />
      </div>
    </div>
  );
}
