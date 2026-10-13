import {
  BellRing,
  CalendarDays,
  ChartColumn,
  House,
  Lightbulb,
  Newspaper,
  PiggyBank,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavKey =
  | "home"
  | "reminders"
  | "calendar"
  | "analytics"
  | "budgets"
  | "savings"
  | "tips"
  | "news";

export type NavItem = { key: NavKey; href: string; icon: LucideIcon };

export const NAV_ITEMS: Record<NavKey, NavItem> = {
  home: { key: "home", href: "/dashboard", icon: House },
  reminders: { key: "reminders", href: "/reminders", icon: BellRing },
  calendar: { key: "calendar", href: "/calendar", icon: CalendarDays },
  analytics: { key: "analytics", href: "/analytics", icon: ChartColumn },
  budgets: { key: "budgets", href: "/budgets", icon: Wallet },
  savings: { key: "savings", href: "/savings", icon: PiggyBank },
  tips: { key: "tips", href: "/tips", icon: Lightbulb },
  news: { key: "news", href: "/news", icon: Newspaper },
};

const pick = (keys: NavKey[]) => keys.map((k) => NAV_ITEMS[k]);

// Mobil alsó fül-sáv (§14.3): 4 fő elem + "Még"
export const BOTTOM_NAV = pick(["home", "reminders", "analytics", "budgets"]);
// A "Még" lap tartalma (a Profil és a Letöltés külön elem)
export const MORE_NAV = pick(["calendar", "savings", "tips", "news"]);
// Tablet ikon-sín és asztali oldalsáv
export const SIDE_NAV = pick([
  "home",
  "reminders",
  "calendar",
  "analytics",
  "budgets",
  "savings",
  "tips",
  "news",
]);

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
