import { CircleCheck, TriangleAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { BankFlash } from "@/lib/bank/callback";

// Az összekötés eredménye az átirányítás után (a /bank/callback ide küld). Ikon + szöveg; a hiba `role="alert"`, a siker `role="status"`.
export async function BankFlashBanner({ flash }: { flash: BankFlash }) {
  const t = await getTranslations("bank");
  if (flash.kind === "connected") {
    return (
      <p role="status" className="flex items-start gap-3 rounded-card border border-success/40 bg-success/10 p-4 text-success-text">
        <CircleCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
        <span>{t("flash.connected")}</span>
      </p>
    );
  }
  return (
    <div role="alert" className="flex items-start gap-3 rounded-card border border-danger/40 bg-danger/10 p-4 text-danger-text">
      <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold">{t("error.title")}</p>
        <p>{t(`error.${flash.reason}`)}</p>
      </div>
    </div>
  );
}
