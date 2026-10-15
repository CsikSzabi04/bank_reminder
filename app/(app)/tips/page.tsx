import type { Metadata } from "next";
import { Lightbulb } from "lucide-react";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { TipCard } from "@/components/tips/tip-card";
import { TipsToggle } from "@/components/tips/tips-toggle";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney, todayIn } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { sumMoney } from "@/lib/money";
import { getCurrentProfile } from "@/lib/profile/queries";
import { buildTipCards } from "@/lib/tips/cards";
import { getActiveTips, getDoneSaving } from "@/lib/tips/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tips");
  return { title: t("title") };
}

const LINK_BTN = "inline-flex min-h-11 items-center rounded-control border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2";

export default async function TipsPage() {
  const t = await getTranslations("tips");
  const locale = (await getLocale()) as Locale;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=%2Ftips");

  const enabled = profile.tips_enabled;
  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <TipsToggle enabled={enabled} className={LINK_BTN} />
    </div>
  );
  const disclaimer = <p className="text-sm text-text-2">{t("disclaimerLong")}</p>;

  if (!enabled) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        {header}
        <EmptyState icon={Lightbulb} title={t("disabled.title")} body={t("disabled.body")} />
        {disclaimer}
      </div>
    );
  }

  const [tips, doneSaving] = await Promise.all([getActiveTips(todayIn(profile.timezone)), getDoneSaving()]);
  const currency = profile.base_currency;
  const cards = await buildTipCards(tips, locale, currency);
  const save = cards.filter((c) => c.severity === "save");
  const warn = cards.filter((c) => c.severity === "warn");
  const info = cards.filter((c) => c.severity === "info");

  // az összesített becslés a megtakarítás-szintű tippek becsléseiből (centre pontos összeg)
  const monthly = sumMoney(tips.filter((x) => x.severity === "save").map((x) => x.est ?? 0));
  const yearly = sumMoney(tips.filter((x) => x.severity === "save").map((x) => (x.est ?? 0) * 12));
  const money = (n: number) => formatMoney(n, currency, locale);

  const section = (id: string, title: string, items: typeof cards) =>
    items.length > 0 && (
      <section aria-labelledby={id} className="flex flex-col gap-3">
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {items.map((c) => (
          <TipCard key={c.id} {...c} />
        ))}
      </section>
    );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      {header}
      {monthly > 0 && (
        <p className="rounded-card border border-border bg-primary-soft/50 p-4 text-base font-medium">{t("totalSaving", { monthly: money(monthly), yearly: money(yearly) })}</p>
      )}
      {cards.length === 0 ? (
        <EmptyState icon={Lightbulb} title={t("empty.title")} body={t("empty.body")} />
      ) : (
        <>
          {section("tips-save", t("sections.save"), save)}
          {section("tips-warn", t("sections.warn"), warn)}
          {section("tips-info", t("sections.info"), info)}
        </>
      )}
      {doneSaving > 0 && <p className="text-base font-medium text-success-text">{t("doneSaving", { monthly: money(doneSaving) })}</p>}
      {disclaimer}
    </div>
  );
}
