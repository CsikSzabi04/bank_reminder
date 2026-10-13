"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { setTipsEnabled } from "@/lib/tips/actions";

// Tippek be/ki: a kikapcsolt állapotban a tippek nem számolódnak és nem jelennek meg
export function TipsToggle({ enabled, className }: { enabled: boolean; className: string }) {
  const t = useTranslations("tips");
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={() =>
        startTransition(async () => {
          const res = await setTipsEnabled(!enabled);
          if (!res.ok) toast.show({ message: t("failed"), tone: "error" });
          else router.refresh();
        })
      }
    >
      {enabled ? t("turnOff") : t("turnOn")}
    </button>
  );
}
