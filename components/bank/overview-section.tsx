import { Landmark, Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";

const CARD = "rounded-card border border-border bg-surface p-5 shadow-card";

// Bank-összekötés (Enable Banking). A B-41 tölti fel: állapot-kártya, összekötés, ConsentTimeline.
// Enable-jogosultság nélkül (advanced.md §2.1) csak az őszinte magyarázat látszik, a többi rejtett.
export async function OverviewSection({ syncAllowed }: { syncAllowed: boolean }) {
  const t = await getTranslations("bank.overview");

  if (!syncAllowed) {
    return (
      <section className={`${CARD} flex flex-col gap-3`}>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Lock className="size-5 text-text-2" aria-hidden />
          {t("title")}
        </h2>
        <p>{t("restricted.body")}</p>
        <p className="text-sm text-text-2">{t("restricted.hint")}</p>
      </section>
    );
  }

  return <EmptyState icon={Landmark} title={t("empty.title")} body={t("empty.body")} />;
}
