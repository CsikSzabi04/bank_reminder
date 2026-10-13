import {
  Baby,
  Banknote,
  Bus,
  Cloud,
  CircleEllipsis,
  CreditCard,
  Dumbbell,
  Gamepad2,
  GraduationCap,
  Gift,
  HeartPulse,
  House,
  Landmark,
  Music,
  PartyPopper,
  Plane,
  ShieldCheck,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  SprayCan,
  Tag,
  Tv,
  Utensils,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

// A `categories.icon` (lucide-név, Függelék C) → ikon. Statikus térkép: csak a használt ikonok kerülnek a csomagba.
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  tv: Tv,
  music: Music,
  cloud: Cloud,
  "gamepad-2": Gamepad2,
  home: House,
  zap: Zap,
  wrench: Wrench,
  smartphone: Smartphone,
  wifi: Wifi,
  "shield-check": ShieldCheck,
  landmark: Landmark,
  banknote: Banknote,
  "credit-card": CreditCard,
  "shopping-basket": ShoppingBasket,
  "spray-can": SprayCan,
  bus: Bus,
  utensils: Utensils,
  "shopping-bag": ShoppingBag,
  "party-popper": PartyPopper,
  dumbbell: Dumbbell,
  sparkles: Sparkles,
  "heart-pulse": HeartPulse,
  "graduation-cap": GraduationCap,
  baby: Baby,
  gift: Gift,
  plane: Plane,
  "circle-ellipsis": CircleEllipsis,
  tag: Tag,
};

// A hívó közvetlenül `CATEGORY_ICONS[name] ?? FALLBACK_ICON`-t használja (statikus hivatkozás: a React-lint
// a függvényhívásból visszaadott komponenst "renderelés közben létrehozottnak" venné).
export const FALLBACK_ICON: LucideIcon = Tag;

// Csoport-szín (color_slot 1–7, 9; a 8. piros szándékosan nincs kiosztva) → CSS változó (§15.3)
const SLOTS = new Set([1, 2, 3, 4, 5, 6, 7, 9]);
export function categoryColorVar(slot: number | null | undefined): string {
  return `var(--chart-${slot && SLOTS.has(slot) ? slot : 9})`;
}

export type CategoryView = {
  id: string;
  icon: string;
  colorSlot: number;
  name: string;
};

// A kategória megjelenítendő neve a nyelv szerint; hiányzó fordításnál a másik nyelv
export function categoryName(
  c: { name_hu: string | null; name_en: string | null },
  locale: "hu" | "en",
): string {
  return (locale === "hu" ? c.name_hu ?? c.name_en : c.name_en ?? c.name_hu) ?? "";
}
