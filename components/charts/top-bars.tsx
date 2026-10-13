export type TopBarItem = {
  key: string;
  label: string;
  valueText: string;
  /** a sáv hossza a legnagyobbhoz képest (0–1) — csak rajzhoz */
  fraction: number;
  color: string;
};

// Vízszintes sávok (C4): vékony sáv, értékfelirat a végén; a szín a tétel kategória-csoportját követi.
// HTML (nem SVG), így a hosszú név törik, és mobilon sem lóg ki.
export function TopBars({ items, ariaLabel }: { items: TopBarItem[]; ariaLabel: string }) {
  return (
    <ol aria-label={ariaLabel} className="flex flex-col gap-3">
      {items.map((i) => (
        <li key={i.key} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 flex-1 truncate font-medium">{i.label}</span>
            <span className="shrink-0 tabular-nums text-text-2">{i.valueText}</span>
          </div>
          <div aria-hidden className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.round(i.fraction * 100))}%`, background: i.color }} />
          </div>
        </li>
      ))}
    </ol>
  );
}
