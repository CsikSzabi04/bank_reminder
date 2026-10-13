import { CATEGORY_ICONS, FALLBACK_ICON, categoryColorVar } from "@/lib/category-icons";
import { cn } from "@/lib/utils";

// Kerek ikon-csempe a kategória csoport-színével. Díszítő (aria-hidden): a név mindig szövegként is ott van mellette.
export function CategoryIcon({
  icon,
  colorSlot,
  size = 40,
  className,
}: {
  icon: string | null | undefined;
  colorSlot: number | null | undefined;
  size?: number;
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[icon ?? ""] ?? FALLBACK_ICON;
  const color = categoryColorVar(colorSlot);
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-control", className)}
      // 18%-os színes háttér + teli színű ikon; a háttér a felülettel keveredik, így sötét módban is jó
      style={{ width: size, height: size, background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
    >
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} />
    </span>
  );
}
