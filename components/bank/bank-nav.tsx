import { ChevronRight, Landmark, ListChecks, Smartphone, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BANK_SECTIONS, type BankSection } from "@/lib/bank/sections";
import { cn } from "@/lib/utils";

const ICONS: Record<BankSection, LucideIcon> = {
  overview: Landmark,
  android: Smartphone,
  rules: ListChecks,
};

// Szakasz-lista: ugyanaz a minta, mint a Profilnál (mobilon lista → részlet, asztalon belső nav)
export async function BankNav({ current, className }: { current: BankSection; className?: string }) {
  const t = await getTranslations("bank.sections");
  return (
    <nav aria-label={t("label")} className={className}>
      <ul className="flex flex-col gap-1">
        {BANK_SECTIONS.map((section) => {
          const Icon = ICONS[section];
          const active = section === current;
          return (
            <li key={section}>
              <Link
                href={`/bank?section=${section}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-control px-3 text-base font-medium",
                  active ? "bg-primary-soft text-primary-text" : "text-text hover:bg-surface-2",
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span className="flex-1">{t(section)}</span>
                <ChevronRight className="size-4 text-text-muted md:hidden" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
