import { useId, type ReactNode } from "react";
import { donutArcs } from "@/lib/charts/donut";
import { TextureDefs, textureFill } from "./texture-defs";

export type DonutSlice = {
  key: string;
  label: string;
  value: number;
  /** CSS szín (pl. var(--chart-1)); a szín az entitást követi, nem a rangsort (§15.3) */
  color: string;
  /** a formázott érték és arány (a hívó formázza: pénznem, nyelv) — ugyanaz kerül a jelmagyarázatba és a tooltipbe */
  valueText: string;
  shareText: string;
};

// Kategória-fánk (C1): SVG, a szeletek között felület-színű rés; közepén a hívó tartalma (hero összeg).
// A szín soha nem az egyetlen jelentéshordozó: a jelmagyarázat név + összeg + arány szövegesen is megvan (§15.3/15.5).
export function DonutChart({
  slices,
  size = 200,
  thickness = 34,
  ariaLabel,
  children,
}: {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  ariaLabel: string;
  children?: ReactNode;
}) {
  const arcs = donutArcs(
    slices.map((s) => ({ key: s.key, value: s.value })),
    { size, thickness },
  );
  const byKey = new Map(slices.map((s) => [s.key, s]));
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");

  return (
    <div className="@container">
      <div className="flex flex-col gap-5 @md:flex-row @md:items-center">
        <div className="relative mx-auto shrink-0" style={{ width: size, height: size }}>
          <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={ariaLabel}>
            <TextureDefs prefix={uid} />
            {arcs.length === 0 ? (
              // nincs adat: halvány üres gyűrű
              <circle
                cx={size / 2}
                cy={size / 2}
                r={size / 2 - thickness / 2}
                fill="none"
                style={{ stroke: "var(--border)" }}
                strokeWidth={thickness}
              />
            ) : (
              arcs.map((arc, i) => {
                const slice = byKey.get(arc.key)!;
                return (
                  <g key={arc.key}>
                    <path d={arc.path} style={{ fill: slice.color }} fillRule="evenodd" className="chart-slice">
                      {/* natív tooltip hover/hosszú érintésre; a tartalom a jelmagyarázatban is szövegként megvan */}
                      <title>{`${slice.label}: ${slice.valueText} (${slice.shareText})`}</title>
                    </path>
                    <path d={arc.path} fill={textureFill(uid, i)} fillRule="evenodd" className="chart-texture" pointerEvents="none" />
                  </g>
                );
              })
            )}
          </svg>
          {children && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
          )}
        </div>

        <ul className="grid flex-1 gap-2 text-sm">
          {arcs.map((arc, i) => {
            const slice = byKey.get(arc.key)!;
            return (
              <li key={arc.key} className="flex items-center gap-2">
                <span aria-hidden data-texture={i % 4} className="size-3 shrink-0 rounded-full" style={{ background: slice.color }} />
                <span className="min-w-0 flex-1 truncate">{slice.label}</span>
                <span className="font-medium tabular-nums">{slice.valueText}</span>
                <span className="w-10 text-right text-text-2 tabular-nums">{slice.shareText}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
