import { Car, Gift, GraduationCap, House, PiggyBank, Plane, ShieldCheck, Smartphone, type LucideIcon } from "lucide-react";

// A célokhoz választható ikonok (`savings_goals.icon`): statikus térkép, csak ezek kerülnek a csomagba
export const GOAL_ICONS: Record<string, LucideIcon> = {
  "piggy-bank": PiggyBank,
  "shield-check": ShieldCheck,
  plane: Plane,
  smartphone: Smartphone,
  home: House,
  gift: Gift,
  "graduation-cap": GraduationCap,
  car: Car,
};
export const GOAL_ICON_KEYS = ["piggy-bank", "shield-check", "plane", "smartphone", "home", "gift", "graduation-cap", "car"] as const;
export const GOAL_COLOR_SLOTS = [1, 2, 3, 4, 5, 6, 7] as const;

export const PRESETS = ["emergency", "vacation", "phone", "custom"] as const;
export type Preset = (typeof PRESETS)[number];

// Az előkészített célok (§16.4): ikon + szín + (a vészhelyzeti alapnál) számolt cél
export const PRESET_DEFAULTS: Record<Preset, { icon: (typeof GOAL_ICON_KEYS)[number]; colorSlot: number }> = {
  emergency: { icon: "shield-check", colorSlot: 6 },
  vacation: { icon: "plane", colorSlot: 3 },
  phone: { icon: "smartphone", colorSlot: 1 },
  custom: { icon: "piggy-bank", colorSlot: 1 },
};

export function resolvePreset(param: string | undefined): Preset {
  return (PRESETS as readonly string[]).includes(param ?? "") ? (param as Preset) : "custom";
}
