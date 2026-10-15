"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { PREFS_EVENT, readPref, writePref, type PrefName } from "@/lib/display-prefs";
import { cn } from "@/lib/utils";

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener(PREFS_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(PREFS_EVENT, cb);
  };
};

function Switch({ name, label, hint }: { name: PrefName; label: string; hint: string }) {
  const on = useSyncExternalStore(subscribe, () => readPref(name), () => false);
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <span id={`pref-${name}`} className="block font-medium">
          {label}
        </span>
        <span id={`pref-${name}-hint`} className="text-sm text-text-2">
          {hint}
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={`pref-${name}`}
        aria-describedby={`pref-${name}-hint`}
        onClick={() => writePref(name, !on)}
        className="relative flex h-11 w-14 shrink-0 items-center justify-center"
      >
        <span aria-hidden className={cn("flex h-7 w-12 items-center rounded-full border border-border px-0.5 transition-colors", on ? "justify-end bg-primary" : "justify-start bg-surface-2")}>
          <span className="size-6 rounded-full bg-white shadow-card" />
        </span>
      </button>
    </div>
  );
}

// Eszköz-szintű megjelenés-kapcsolók (Profil → Megjelenés): kontrasztosabb diagramok (textúra) · kevesebb mozgás
export function DisplayPrefs() {
  const t = useTranslations("profile.appearance");
  return (
    <div className="flex flex-col gap-4 border-t border-border pt-4">
      <Switch name="contrastCharts" label={t("contrastCharts")} hint={t("contrastChartsHint")} />
      <Switch name="reduceMotion" label={t("reduceMotion")} hint={t("reduceMotionHint")} />
      <p className="text-sm text-text-2">{t("devicePrefsHint")}</p>
    </div>
  );
}
