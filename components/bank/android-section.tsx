import { Smartphone } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { AndroidGuide } from "@/components/bank/android-guide";
import { CopyField } from "@/components/bank/copy-field";
import { IngestPanel } from "@/components/bank/ingest-panel";
import { IngestTest } from "@/components/bank/ingest-test";
import { NativeAppCard } from "@/components/bank/native-app-card";
import { PlatformHint } from "@/components/bank/platform-hint";
import { EmptyState } from "@/components/ui/empty-state";
import { curlExample, ingestStatus, JSON_TEMPLATE, webhookUrl } from "@/lib/bank/ingest";
import { getIngestOverview } from "@/lib/bank/ingest-queries";
import { formatAge } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";

// Android értesítés-olvasás (advanced.md §8.3): mindenkinek elérhető. Ha a szerver-oldal (A-43/A-44) még nincs telepítve,
// a „hamarosan" állapot látszik — a felület ilyenkor nem kínál olyat, ami hibára futna.
export async function AndroidSection({ timeZone }: { timeZone: string }) {
  const t = await getTranslations("bank.android");
  const locale = (await getLocale()) as Locale;
  const overview = await getIngestOverview();

  if (!overview.available) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState icon={Smartphone} title={t("empty.title")} body={t("empty.body")} />
        <PlatformHint />
        <NativeAppCard />
      </div>
    );
  }

  const url = webhookUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const status = ingestStatus(overview.events);
  const statusText = status.kind === "never" ? t("status.never") : t(`status.${status.kind}`, { when: formatAge(status.at, new Date(), locale) });

  return (
    <div className="flex flex-col gap-4">
      <p>{t("intro")}</p>
      <p aria-live="polite" className={status.kind === "stale" ? "font-medium text-warning-text" : "text-sm text-text-2"}>
        {statusText}
      </p>
      <PlatformHint />

      <IngestPanel tokens={overview.tokens} suggestions={overview.suggestions} timeZone={timeZone} />

      <section aria-labelledby="hook-title" className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-card">
        <h3 id="hook-title" className="text-lg font-semibold">
          {t("hook.title")}
        </h3>
        {url ? (
          <>
            <CopyField label={t("hook.url")} value={url} />
            <p className="text-sm text-text-2">{t("hook.header")}</p>
            <CopyField label={t("hook.json")} value={JSON_TEMPLATE} multiline />
            <CopyField label={t("hook.curl")} value={curlExample(url)} multiline />
          </>
        ) : (
          <p className="text-text-2">{t("hook.urlMissing")}</p>
        )}
      </section>

      <AndroidGuide />
      <IngestTest />
      <NativeAppCard />
      <p className="text-sm text-text-2">{t("privacy")}</p>
    </div>
  );
}
