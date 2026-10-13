"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Belépés | Regisztráció: két külön útvonal, ezért linkek (nem ARIA-fülek)
export function AuthTabs() {
  const t = useTranslations("auth.tabs");
  const pathname = usePathname();
  const tabs = [
    { href: "/login", label: t("login") },
    { href: "/signup", label: t("signup") },
  ];
  return (
    <nav aria-label={t("label")} className="mb-6 grid grid-cols-2 rounded-control bg-surface-2 p-1">
      {tabs.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center justify-center rounded-[10px] text-sm font-medium transition-colors",
              active ? "bg-surface text-primary-text shadow-card" : "text-text-2 hover:text-text",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
