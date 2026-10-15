import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";

// A bank-hozzáférés lejárat-értesítései kötelezőek (advanced.md §6, D4): ezért itt NINCS kapcsoló — csak lakat és magyarázat.
// Szándékosan nem tartalmaz <input>-ot (a teszt őrzi); a „kötelező” állapot szövegben is kimondott, nem csak ikonban.
export function MandatoryConsentRow() {
  const t = useTranslations("notifications.settings");
  return (
    <div className="flex items-start gap-3 text-sm">
      <Lock className="mt-0.5 size-5 shrink-0 text-text-2" aria-hidden />
      <p>
        <span className="block font-medium">{t("bankConsent")}</span>
        <span className="block text-text-2">{t("bankConsentHint")}</span>
      </p>
    </div>
  );
}
