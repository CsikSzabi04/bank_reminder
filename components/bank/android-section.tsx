import { Smartphone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";

// Android értesítés-olvasás (MacroDroid/Tasker + natív app). A B-43 tölti fel; mindenkinek elérhető (§8.3).
export async function AndroidSection() {
  const t = await getTranslations("bank.android");
  return <EmptyState icon={Smartphone} title={t("empty.title")} body={t("empty.body")} />;
}
