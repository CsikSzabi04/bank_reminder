import { linear, linePath } from "@/lib/charts/axes";

// Apró trendvonal a KPI-kártyákhoz: dekoratív (a szám és a változás szövegben ott van) → aria-hidden
export function Sparkline({ values, width = 84, height = 28 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const pad = 3;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const x = linear(0, values.length - 1, pad, width - pad);
  const y = linear(min, max === min ? min + 1 : max, height - pad, pad);
  const pts = values.map((v, i) => [x(i), y(v)] as const);
  const last = pts[pts.length - 1];
  return (
    <svg aria-hidden width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
      <path d={linePath(pts)} fill="none" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="stroke-primary" />
      <circle cx={last[0]} cy={last[1]} r="2.5" className="fill-primary" />
    </svg>
  );
}
