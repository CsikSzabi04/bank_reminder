"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { InstallButton } from "./install-button";
import { dismissInstall, readNumber, useInstallState, useStoredNumber, writeNumber } from "./install-store";

const VISITS_KEY = "br_visits";
const SESSION_KEY = "br_visit_counted";
const SHOW_AFTER_VISITS = 3; // az első 3 látogatás után (§13.3), elvethető

export function InstallCard() {
  const t = useTranslations("install");
  const visits = useStoredNumber(VISITS_KEY);
  const { state } = useInstallState(true);

  // látogatásonként (munkamenetenként) egyszer számolunk
  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      return;
    }
    // a friss tárolt értékhez adunk hozzá (nem a renderkori pillanatképhez): így nem írunk felül újabb értéket
    writeNumber(VISITS_KEY, readNumber(VISITS_KEY) + 1);
  }, []);

  if (visits < SHOW_AFTER_VISITS || state === null || state === "installed" || state === "dismissed" || state === "unsupported") return null;

  return (
    <section aria-labelledby="install-card-title" className="relative flex flex-col gap-2 rounded-card border border-border bg-primary-soft p-5">
      <button
        type="button"
        onClick={() => dismissInstall()}
        aria-label={t("dismiss")}
        className="absolute top-2 right-2 flex size-11 items-center justify-center rounded-full text-text-2 hover:bg-surface"
      >
        <X className="size-4" aria-hidden />
      </button>
      <h2 id="install-card-title" className="pr-10 text-lg font-semibold">
        {t("cardTitle")}
      </h2>
      <p className="text-text-2">{t("cardBody")}</p>
      <div>
        <InstallButton respectDismissal />
      </div>
    </section>
  );
}
