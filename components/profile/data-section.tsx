import { Download } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { DeleteAccountForm } from "./delete-account-form";

const CARD = "flex flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-card";
const LINK =
  "inline-flex min-h-11 items-center gap-2 rounded-control border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2";

// Profil → Adataim (§19.1): adatletöltés (JSON + CSV) és fiók törlése (veszélyzóna)
export async function DataSection() {
  const t = await getTranslations("profile.data");
  return (
    <div className="flex flex-col gap-4">
      <section className={CARD} aria-labelledby="export-title">
        <h2 id="export-title" className="text-lg font-semibold">
          {t("export.title")}
        </h2>
        <p className="text-sm text-text-2">{t("export.hint")}</p>
        <div className="flex flex-wrap gap-2">
          {/* sima hivatkozások: a válasz fájl-letöltés (Content-Disposition), nem oldal */}
          <a href="/api/export?format=json" download className={LINK}>
            <Download className="size-4" aria-hidden />
            {t("export.json")}
          </a>
          {(["reminders", "occurrences", "expenses"] as const).map((table) => (
            <a key={table} href={`/api/export?format=csv&table=${table}`} download className={LINK}>
              <Download className="size-4" aria-hidden />
              {t(`export.csv.${table}`)}
            </a>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-card border border-danger/40 bg-surface p-5 shadow-card" aria-labelledby="delete-title">
        <h2 id="delete-title" className="text-lg font-semibold text-danger-text">
          {t("delete.title")}
        </h2>
        <DeleteAccountForm />
      </section>
    </div>
  );
}
