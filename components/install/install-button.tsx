"use client";

import { CircleCheck, Download, Info, Share } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { useInstallState } from "./install-store";

const BTN = "inline-flex min-h-11 items-center gap-2 rounded-control border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2";

// „Alkalmazás letöltése" (§13.3): minden platformon a megfelelő útvonalat adja (prompt / kézi útmutató / tájékoztatás).
// `variant="link"`: szöveges link (login-oldal); `respectDismissal`: a „Később" után 7 napig nem jelenik meg.
export function InstallButton({ variant = "button", respectDismissal = false, className }: { variant?: "button" | "link"; respectDismissal?: boolean; className?: string }) {
  const t = useTranslations("install");
  const toast = useToast();
  const { state, prompt } = useInstallState(respectDismissal);
  const [guide, setGuide] = useState<"ios" | "mac" | null>(null);

  if (state === null || state === "dismissed") return null;

  if (state === "installed") {
    return (
      <div className={cn("flex flex-wrap items-center gap-3 text-sm", className)}>
        <span className="inline-flex items-center gap-1.5 font-medium text-success-text">
          <CircleCheck className="size-4" aria-hidden />
          {t("installed")}
        </span>
        <Link href="/profile?section=notifications" className="font-medium text-primary-text underline">
          {t("setupNotifications")}
        </Link>
      </div>
    );
  }

  if (state === "unsupported") {
    return (
      <p className={cn("flex items-start gap-2 text-sm text-text-2", className)}>
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t("unsupported")}
      </p>
    );
  }

  if (state === "ios-other-browser") {
    return (
      <div className={cn("flex flex-col items-start gap-2 text-sm", className)}>
        <p className="text-text-2">{t("otherBrowser")}</p>
        <button
          type="button"
          className={BTN}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.origin + "/install");
              toast.show({ message: t("copied") });
            } catch {
              /* a vágólap nem elérhető: a link a címsorból másolható */
            }
          }}
        >
          {t("copyLink")}
        </button>
      </div>
    );
  }

  const onClick = () => {
    if (state === "promptable") void prompt();
    else setGuide(state === "ios" ? "ios" : "mac");
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          variant === "link" ? "inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary-text underline" : BTN,
          className,
        )}
      >
        <Download className="size-4" aria-hidden />
        {t("cta")}
      </button>

      <BottomSheet open={guide === "ios"} onClose={() => setGuide(null)} title={t("ios.title")}>
        <ol className="flex flex-col gap-3">
          <li className="flex items-center gap-3">
            <Share className="size-5 shrink-0 text-primary-text" aria-hidden />
            {t("ios.step1")}
          </li>
          <li>{t("ios.step2")}</li>
          <li>{t("ios.step3")}</li>
        </ol>
        <p className="mt-4 text-sm text-text-2">{t("ios.note")}</p>
      </BottomSheet>
      <BottomSheet open={guide === "mac"} onClose={() => setGuide(null)} title={t("mac.title")}>
        <p>{t("mac.step")}</p>
      </BottomSheet>
    </>
  );
}
