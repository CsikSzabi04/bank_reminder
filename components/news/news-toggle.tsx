"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { setNewsEnabled } from "@/lib/news/actions";

// Hírek be/ki (profiles.news_enabled): kikapcsolva a /news üres, a Főoldalon nincs hír-sáv
export function NewsToggle({ enabled, className }: { enabled: boolean; className: string }) {
  const t = useTranslations("news");
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
          const res = await setNewsEnabled(!enabled);
          if (!res.ok) toast.show({ message: t("failed"), tone: "error" });
          else router.refresh();
        })
      }
    >
      {enabled ? t("turnOff") : t("turnOn")}
    </button>
  );
}
