import { Smartphone } from "lucide-react";
import { getTranslations } from "next-intl/server";

// Natív Android-app „hamarosan" kártya (advanced.md §8.3, §10.4: P2, a gazda döntésével) — jelzi, hogy még nem elérhető
export async function NativeAppCard() {
  const t = await getTranslations("bank.android.native");
  return (
    <section aria-labelledby="native-title" className="flex flex-col gap-2 rounded-card border border-dashed border-border bg-surface p-5">
      <h3 id="native-title" className="flex flex-wrap items-center gap-2 text-lg font-semibold">
        <Smartphone className="size-5 text-text-2" aria-hidden />
        {t("title")}
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-text-2">{t("soon")}</span>
      </h3>
      <p className="text-text-2">{t("body")}</p>
    </section>
  );
}
