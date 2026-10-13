import { layoutCumulative } from "@/lib/charts/cumulative";
import { ChartLegend } from "./chart-legend";

const W = 360;
const H = 220;
const MARGIN = { top: 14, right: 12, bottom: 24, left: 44 };

// A hónap lefutása (C3): kumulatív vonal + halvány terület az „Ez a hónap"-ra, szaggatott vonal az előző hónapra.
// A vonal végén közvetlen felirat (≤ 4 sorozatnál, §15.5); egy y-tengely.
export function CumulativeLine({
  days,
  current,
  previous,
  currentLabel,
  previousLabel,
  ariaLabel,
  formatAxis,
}: {
  /** a hónap napjainak száma */
  days: number;
  current: number[];
  previous: Array<number | null>;
  currentLabel: string;
  previousLabel: string;
  ariaLabel: string;
  formatAxis: (v: number) => string;
}) {
  const l = layoutCumulative({ days, current, previous, width: W, height: H, margin: MARGIN });
  const labelDays = Array.from({ length: days }, (_, i) => i).filter((i) => i === 0 || (i + 1) % 5 === 0);

  return (
    <figure className="flex flex-col gap-3">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="mx-auto h-auto w-full max-w-[560px]">
        {l.ticks.map((t) => (
          <g key={t.value}>
            <line x1={MARGIN.left} x2={W - MARGIN.right} y1={t.y} y2={t.y} className="stroke-border" strokeWidth="1" />
            <text x={MARGIN.left - 6} y={t.y + 3.5} textAnchor="end" fontSize="10.5" className="fill-text-2">
              {formatAxis(t.value)}
            </text>
          </g>
        ))}
        {l.areaPath && <path d={l.areaPath} className="fill-primary" opacity="0.1" />}
        {l.previousPaths.map((d) => (
          <path key={d} d={d} fill="none" strokeWidth="1.75" strokeDasharray="5 4" className="stroke-text-muted" />
        ))}
        {l.currentPath && <path d={l.currentPath} fill="none" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" className="stroke-primary" />}
        {l.last && (
          <>
            <circle cx={l.last[0]} cy={l.last[1]} r="3.5" className="fill-primary" />
            <text x={l.last[0] - 6} y={l.last[1] - 9} textAnchor="end" fontSize="10.5" fontWeight="600" className="fill-primary-text">
              {currentLabel}
            </text>
          </>
        )}
        {labelDays.map((i) => (
          <text key={i} x={l.x(i)} y={H - 7} textAnchor="middle" fontSize="10.5" className="fill-text-2">
            {i + 1}
          </text>
        ))}
      </svg>
      <ChartLegend
        items={[
          { key: "cur", label: currentLabel, color: "var(--primary)" },
          { key: "prev", label: previousLabel, color: "var(--text-muted)", dashed: true },
        ]}
      />
    </figure>
  );
}
