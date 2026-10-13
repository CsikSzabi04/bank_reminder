import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalDocument } from "@/components/legal/legal-document";

const IDS = ["service", "account", "use", "delivery", "tips", "changes", "contact"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.terms");
  return { title: t("title") };
}

export default async function TermsPage() {
  const t = await getTranslations("legal.terms");
  return (
    <LegalDocument
      title={t("title")}
      sections={IDS.map((id) => ({ id, title: t(`${id}.title`), body: t(`${id}.body`) }))}
    />
  );
}
