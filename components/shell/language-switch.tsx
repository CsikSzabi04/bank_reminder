"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocale } from "@/lib/i18n/actions";
import type { Locale } from "@/lib/i18n/config";
import { Segmented } from "./segmented";

export function LanguageSwitch() {
  const t = useTranslations("common.language");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Segmented<Locale>
      label={t("label")}
      value={locale as Locale}
      disabled={pending}
      onChange={(next) =>
        startTransition(async () => {
          const res = await setLocale(next);
          // teljes újratöltés nélkül: a szerver-komponensek új nyelven renderelődnek újra
          if (res.ok) router.refresh();
        })
      }
      options={[
        { value: "hu", label: t("hu") },
        { value: "en", label: t("en") },
      ]}
    />
  );
}
