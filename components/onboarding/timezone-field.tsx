"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";

const noop = () => () => {};

// Az időzóna automatikus felismerése a böngészőből (a szerver csak az alapértéket ismeri); a szerveren validált
export function TimezoneField({ fallback }: { fallback: string }) {
  const t = useTranslations("onboarding");
  const tz = useSyncExternalStore(
    noop,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || fallback,
    () => fallback,
  );
  return (
    <div className="flex flex-col gap-1">
      <input type="hidden" name="timezone" value={tz} />
      <span className="text-sm font-medium text-text-2">{t("timezone")}</span>
      <span className="min-h-11 rounded-control border border-border bg-surface-2 px-4 py-2.5">{tz}</span>
      <span className="text-sm text-text-muted">{t("timezoneHint")}</span>
    </div>
  );
}
