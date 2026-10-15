import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AndroidSection } from "@/components/bank/android-section";
import { BankNav } from "@/components/bank/bank-nav";
import { OverviewSection } from "@/components/bank/overview-section";
import { RulesSection } from "@/components/bank/rules-section";
import { defaultBankSection, isBankSection, type BankSection } from "@/lib/bank/sections";
import { getBankAccess } from "@/lib/bank/queries";
import { getCurrentProfile } from "@/lib/profile/queries";
import { first } from "@/lib/search-params";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("bank");
  return { title: t("title") };
}

export default async function BankPage(props: PageProps<"/bank">) {
  const t = await getTranslations("bank");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=%2Fbank");

  const { syncAllowed } = await getBankAccess();
  const requested = first((await props.searchParams).section);
  const hasSection = isBankSection(requested);
  const current: BankSection = hasSection ? requested : defaultBankSection(syncAllowed);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <div className="md:grid md:grid-cols-[220px_1fr] md:items-start md:gap-8">
        {/* mobilon: szakasz nélkül lista, szakasszal a részlet; asztalon mindkettő látszik */}
        <BankNav current={current} className={hasSection ? "hidden md:block" : "block"} />
        <div className={hasSection ? "block" : "hidden md:block"}>
          <Link href="/bank" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary-text md:hidden">
            <ChevronLeft className="size-4" aria-hidden />
            {t("back")}
          </Link>
          {current === "overview" && <OverviewSection syncAllowed={syncAllowed} />}
          {current === "android" && <AndroidSection />}
          {current === "rules" && <RulesSection />}
        </div>
      </div>
    </div>
  );
}
