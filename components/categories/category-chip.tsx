import { CATEGORY_ICONS, FALLBACK_ICON, categoryColorVar, type CategoryView } from "@/lib/category-icons";
import { cn } from "@/lib/utils";

// Pill-alakú kategória-jelölő: szín-pötty + ikon + NÉV (a szín soha nem az egyetlen jelentéshordozó)
export function CategoryChip({ category, className }: { category: CategoryView; className?: string }) {
  const Icon = CATEGORY_ICONS[category.icon] ?? FALLBACK_ICON;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs font-medium text-text-2",
        className,
      )}
    >
      <span aria-hidden className="size-2 rounded-full" style={{ background: categoryColorVar(category.colorSlot) }} />
      <Icon aria-hidden className="size-3.5" />
      {category.name}
    </span>
  );
}
