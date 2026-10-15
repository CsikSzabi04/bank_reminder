import { TriangleAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";

// MacroDroid / Tasker beállítás-útmutató (advanced.md §8.3). A két app változó-nevei NEM találgatandók: az útmutató az app saját
// változó-választójára utal, és „nem tesztelt eszközön" jelzést visel, amíg Android-készüléken ki nem próbálták (D8).
export async function AndroidGuide() {
  const t = await getTranslations("bank.android.guide");
  return (
    <section aria-labelledby="android-guide-title" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5 shadow-card">
      <h3 id="android-guide-title" className="text-lg font-semibold">
        {t("title")}
      </h3>
      <p className="flex items-start gap-3 rounded-control bg-warning/15 p-3 text-sm text-warning-text">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{t("untested")}</span>
      </p>
      <ol className="flex list-decimal flex-col gap-2 pl-6">
        <li>{t("s1")}</li>
        <li>{t("s2")}</li>
        <li>{t("s3")}</li>
        <li>{t("s4")}</li>
        <li>{t("s5")}</li>
      </ol>
      <ul className="flex list-disc flex-col gap-1 pl-6 text-sm text-text-2">
        <li>{t("macrodroid")}</li>
        <li>{t("tasker")}</li>
      </ul>
    </section>
  );
}
