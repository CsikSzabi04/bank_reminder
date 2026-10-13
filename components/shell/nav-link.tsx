"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { isActive, NAV_ITEMS, type NavKey } from "./nav-items";

type Variant = "bottom" | "rail" | "sidebar";

const BASE =
  "relative flex items-center rounded-control text-sm font-medium transition-colors";
const IDLE = "text-text-2 hover:bg-surface-2";
const ACTIVE = "bg-primary-soft text-primary";

const LAYOUT: Record<Variant, string> = {
  // 44×44 px-es célméret (§14.14)
  bottom: "min-h-12 min-w-12 flex-1 flex-col justify-center gap-0.5 px-1 text-[11px]",
  rail: "size-11 justify-center",
  sidebar: "min-h-11 gap-3 px-3",
};

// Csak a kulcsot kapja: a Lucide ikon-komponens nem adható át szerver → kliens komponensnek
export function NavLink({ navKey, variant }: { navKey: NavKey; variant: Variant }) {
  const item = NAV_ITEMS[navKey];
  const pathname = usePathname();
  const t = useTranslations("nav");
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  const label = t(item.key);

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      // az ikon-sínen nincs látható felirat: a title tooltipként szolgál
      title={variant === "rail" ? label : undefined}
      aria-label={variant === "rail" ? label : undefined}
      className={cn(BASE, LAYOUT[variant], active ? ACTIVE : IDLE)}
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      {variant !== "rail" && <span className="truncate">{label}</span>}
    </Link>
  );
}
