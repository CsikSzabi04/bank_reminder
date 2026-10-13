import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalDocument } from "@/components/legal/legal-document";

const IDS = ["controller", "data", "purpose", "never", "processors", "retention", "rights", "cookies"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.privacy");
  return { title: t("title") };
}

export default async function PrivacyPage() {
  const t = await getTranslations("legal.privacy");
  return (
    <LegalDocument
      title={t("title")}
      sections={IDS.map((id) => ({ id, title: t(`${id}.title`), body: t(`${id}.body`) }))}
    />
  );
}
