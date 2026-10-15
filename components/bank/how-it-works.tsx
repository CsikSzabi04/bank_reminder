import { CircleHelp } from "lucide-react";
import { getTranslations } from "next-intl/server";

// „Hogyan működik?" súgó a /bank oldalon (advanced.md §10.5 B-48): natív <details> — billentyűzettel és képernyőolvasóval is kezelhető
export async function HowItWorks() {
  const t = await getTranslations("bank.help");
  return (
    <details className="group rounded-card border border-border bg-surface p-4 shadow-card">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-medium">
        <CircleHelp className="size-5 text-text-2" aria-hidden />
        {t("summary")}
      </summary>
      <ul className="mt-3 flex list-disc flex-col gap-2 pl-6 text-text-2">
        <li>{t("p1")}</li>
        <li>{t("p2")}</li>
        <li>{t("p3")}</li>
        <li>{t("p4")}</li>
        <li>{t("p5")}</li>
      </ul>
    </details>
  );
}
