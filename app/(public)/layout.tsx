import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitch } from "@/components/shell/language-switch";
import { ThemeSwitch } from "@/components/shell/theme-switch";
import { BRAND } from "@/lib/brand";

// Kijelentkezve is elérhető tartalmi oldalak (adatkezelés, ÁSZF, telepítés)
export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations("legal");
  return (
    <div className="min-h-dvh bg-bg">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link href="/" className="font-semibold">
            {BRAND.name}
          </Link>
          <Link href="/login" className="flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary-text">
            <ArrowLeft className="size-4" aria-hidden />
            {t("back")}
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-2xl px-4 py-8">
        {children}
      </main>
      <footer className="mx-auto flex max-w-2xl flex-wrap items-center gap-3 px-4 pb-10">
        <LanguageSwitch />
        <ThemeSwitch />
      </footer>
    </div>
  );
}
