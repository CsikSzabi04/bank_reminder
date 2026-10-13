import { TriangleAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

export type LegalSection = { id: string; title: string; body: string };

// Jogi oldal váz: "TERVEZET" jelzés + szakaszok (§14, B-32). A szöveget az üzemeltető adja (§26-Q7).
export async function LegalDocument({ title, sections }: { title: string; sections: LegalSection[] }): Promise<ReactNode> {
  const t = await getTranslations("legal");
  return (
    <article className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold">{title}</h1>
      <p
        role="note"
        className="flex items-start gap-2 rounded-control border border-warning/50 bg-surface-2 px-4 py-3 text-sm text-warning-text"
      >
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{t("draft")}</span>
      </p>
      {sections.map((s, i) => (
        <section key={s.id} aria-labelledby={`legal-${s.id}`} className="flex flex-col gap-1.5">
          <h2 id={`legal-${s.id}`} className="text-lg font-semibold">
            {`${i + 1}. ${s.title}`}
          </h2>
          <p className="text-text-2">{s.body}</p>
        </section>
      ))}
    </article>
  );
}
