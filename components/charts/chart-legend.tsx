export type LegendItem = {
  key: string;
  label: string;
  color: string;
  /** csíkozott kitöltés (a „hátralévő"): a textúra a színtől független jelzés (§15.5) */
  hatched?: boolean;
  /** szaggatott vonal (átlag / előző hónap) */
  dashed?: boolean;
};

// Jelmagyarázat ≥ 2 sorozatnál (§15.5); a szín mellett a mintázat is jelzi a sorozatot
export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-2">
      {items.map((i) => (
        <li key={i.key} className="flex items-center gap-1.5">
          {i.dashed ? (
            <svg aria-hidden width="18" height="8" viewBox="0 0 18 8">
              <line x1="0" y1="4" x2="18" y2="4" strokeWidth="2" strokeDasharray="4 3" style={{ stroke: i.color }} />
            </svg>
          ) : (
            <span
              aria-hidden
              className="size-3 shrink-0 rounded-[3px]"
              style={
                i.hatched
                  ? { border: `1.5px solid ${i.color}`, background: `repeating-linear-gradient(45deg, ${i.color} 0 2px, transparent 2px 5px)` }
                  : { background: i.color }
              }
            />
          )}
          {i.label}
        </li>
      ))}
    </ul>
  );
}
