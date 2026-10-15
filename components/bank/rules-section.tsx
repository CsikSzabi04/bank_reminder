import { ListChecks } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";

// Kereskedő-szabályok és „Besorolásra vár". A B-44 tölti fel; mindkét forrásra érvényes (§8.4).
export async function RulesSection() {
  const t = await getTranslations("bank.rules");
  return <EmptyState icon={ListChecks} title={t("empty.title")} body={t("empty.body")} />;
}
