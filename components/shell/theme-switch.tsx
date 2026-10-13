"use client";

import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { Segmented } from "./segmented";

const noopSubscribe = () => () => {};

// A téma csak a kliensen ismert → szerveren/hidratáláskor nincs kijelölt elem (nincs eltérés)
export function ThemeSwitch() {
  const t = useTranslations("common.theme");
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  return (
    <Segmented
      label={t("label")}
      value={mounted ? (theme as "light" | "dark" | "system" | undefined) : undefined}
      onChange={setTheme}
      options={[
        { value: "light", label: t("light") },
        { value: "dark", label: t("dark") },
        { value: "system", label: t("system") },
      ]}
    />
  );
}
