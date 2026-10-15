"use client";

import { Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const isApple = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);

// iPhone-jelzés (advanced.md §8.3): az iOS nem engedi más appok értesítéseinek olvasását. Csak a kliensen dől el (a szerver nem
// tudja az eszközt), a hidratálás-biztos useSyncExternalStore-ral: szerveren és az első festéskor nincs jelzés.
export function PlatformHint() {
  const t = useTranslations("bank.android");
  const apple = useSyncExternalStore(subscribe, isApple, () => false);
  if (!apple) return null;
  return (
    <p role="note" className="flex items-start gap-3 rounded-card border border-border bg-surface-2 p-4">
      <Info className="mt-0.5 size-5 shrink-0 text-text-2" aria-hidden />
      <span>{t("ios")}</span>
    </p>
  );
}
