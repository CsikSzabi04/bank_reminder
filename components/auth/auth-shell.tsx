import { Bell } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { LanguageSwitch } from "@/components/shell/language-switch";
import { ThemeSwitch } from "@/components/shell/theme-switch";
import { BRAND } from "@/lib/brand";

// A kijelentkezett oldalak közös kerete (§14.4): középre igazított kártya, váltók, "nem bank" szöveg
export async function AuthShell({ children }: { children: ReactNode }) {
  const t = await getTranslations();
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-2 px-4 py-10">
      <main id="main" className="w-full max-w-[440px]">
        <div className="mb-6 flex flex-col items-center gap-1 text-center">
          <Bell className="size-9 text-primary" aria-hidden />
          <p className="text-2xl font-semibold">{BRAND.name}</p>
          <p className="text-text-2">{t("auth.tagline")}</p>
        </div>
        <div className="rounded-card border border-border bg-surface p-6 shadow-card">{children}</div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <LanguageSwitch />
          <ThemeSwitch />
        </div>
        <p className="mt-4 text-center text-sm text-text-muted">{t("common.disclaimer.notBank")}</p>
      </main>
    </div>
  );
}
