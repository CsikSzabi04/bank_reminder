import { Clock, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { consentBannerInfo, type ConsentBannerInfo } from "@/lib/bank/connections";
import { getBankAccess, getBankConnections } from "@/lib/bank/queries";

// A sáv megjelenése (ikon + szöveg + link); külön, hogy a /dev/ui adat nélkül is mutathassa
export async function ConsentBannerView({ info }: { info: ConsentBannerInfo }) {
  const t = await getTranslations("bank.banner");
  const Icon = info.expired ? TriangleAlert : Clock;
  const text = info.expired ? t("expired", { bank: info.bank }) : t("soon", { bank: info.bank, count: info.daysLeft });
  return (
    <Link
      href="/bank?section=overview"
      className={`flex min-h-12 items-center gap-3 rounded-card border p-4 font-medium ${
        info.expired ? "border-danger/40 bg-danger/10 text-danger-text" : "border-warning/50 bg-warning/15 text-warning-text"
      }`}
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      <span className="flex-1">{text}</span>
      <span className="shrink-0 underline underline-offset-2">{t("cta")}</span>
    </Link>
  );
}

// Főoldal-sáv (advanced.md §8.5): ≤ 30 nap a bank-hozzáférés lejáratáig → figyelmeztetés a /bank linkkel.
// Nem kritikus elem: hiba esetén nem jelenik meg, és a Főoldalt nem viszi el.
export async function ConsentBanner({ timeZone }: { timeZone: string }) {
  let info: ConsentBannerInfo | null;
  try {
    if (!(await getBankAccess()).syncAllowed) return null;
    info = consentBannerInfo(await getBankConnections(), timeZone);
  } catch {
    return null;
  }
  return info ? <ConsentBannerView info={info} /> : null;
}
