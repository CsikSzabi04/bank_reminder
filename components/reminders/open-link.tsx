import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { externalUrlHost, safeExternalUrl } from "@/lib/safe-url";
import { cn } from "@/lib/utils";

// „Megnyitás ↗": az emlékeztető külső hivatkozása (pl. a vásárlás oldala). Csak http/https (safeExternalUrl), új lapon,
// `rel="noopener noreferrer"`; érvénytelen/veszélyes érték esetén semmit nem renderel. A cél-méret ≥ 44 px, a felirat mellett
// a gazdagép is látszik a képernyőolvasónak (a felhasználó tudja, hova visz).
export function OpenLink({ url, name, className }: { url: string | null | undefined; name: string; className?: string }) {
  const t = useTranslations("reminders");
  const href = safeExternalUrl(url);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("openLinkAria", { name, host: externalUrlHost(href) ?? "" })}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-1 rounded-control border border-border bg-surface px-3 text-sm font-medium text-primary-text hover:bg-surface-2",
        className,
      )}
    >
      {t("openLink")}
      <ExternalLink className="size-4" aria-hidden />
    </a>
  );
}
