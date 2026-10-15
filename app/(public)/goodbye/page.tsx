import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("goodbye");
  return { title: t("title"), robots: { index: false } };
}

// Fiók-törlés után (§19.4): megerősítés + újrakezdés lehetősége; kijelentkezve is elérhető
export default async function GoodbyePage() {
  const t = await getTranslations("goodbye");
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <CheckCircle2 className="size-12 text-success-text" aria-hidden />
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="max-w-md text-text-2">{t("body")}</p>
      <Link href="/signup" className="flex min-h-12 items-center rounded-control bg-primary px-6 font-medium text-primary-fg">
        {t("again")}
      </Link>
    </div>
  );
}
