import { useId } from "react";
import { topRoundedRect } from "@/lib/charts/axes";
import { layoutStacked } from "@/lib/charts/stacked";
import { ChartLegend, type LegendItem } from "./chart-legend";
import { TextureDefs, textureFill } from "./texture-defs";

export type StackSeries = {
  key: string;
  label: string;
  color: string;
  hatched?: boolean;
  values: number[];
};

const W = 360;
const H = 220;
const MARGIN = { top: 12, right: 8, bottom: 24, left: 44 };

// Halmozott oszlopdiagram (C2 havi trend, C5 kategóriák alakulása): SVG, JS nélkül is kirajzolódik.
// Felül lekerekített oszlop, 2 px rés a szegmensek közt, szaggatott átlag-vonal, kiemelt (aktuális) hónap, egy y-tengely (§15.4).
// A „hátralévő" csíkozott (textúra = a szín mellett második jelzés); minden oszlopnak natív tooltipje van.
export function StackedBars({
  categories,
  series,
  average,
  highlight,
  ariaLabel,
  formatAxis,
  formatValue,
  legendExtra = [],
}: {
  categories: string[];
  series: StackSeries[];
  /** vízszintes szaggatott átlag-vonal */
  average?: { value: number; label: string };
  /** a kiemelt kategória indexe (az aktuális hónap) */
  highlight?: number;
  ariaLabel: string;
  formatAxis: (v: number) => string;
  formatValue: (v: number) => string;
  legendExtra?: LegendItem[];
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const layout = layoutStacked({ values: series.map((s) => s.values), width: W, height: H, margin: MARGIN });
  const solid = series.map((s, i) => ({ s, i })).filter(({ s }) => !s.hatched);
  const multiSolid = solid.length > 1;
  const solidIndex = new Map(solid.map(({ i }, n) => [i, n]));
  const step = categories.length > 8 ? 2 : 1;
  const showLabel = (i: number) => (categories.length - 1 - i) % step === 0;

  return (
    <figure className="flex flex-col gap-3">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="mx-auto h-auto w-full max-w-[560px]">
        <TextureDefs prefix={uid} />
        <defs>
          {series
            .filter((s) => s.hatched)
            .map((s) => (
              <pattern key={s.key} id={`${uid}-${s.key}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" style={{ fill: s.color, opacity: 0.18 }} />
                <line x1="0" y1="0" x2="0" y2="6" strokeWidth="2.5" style={{ stroke: s.color }} />
              </pattern>
            ))}
        </defs>

        {layout.ticks.map((t) => (
          <g key={t.value}>
            <line x1={MARGIN.left} x2={W - MARGIN.right} y1={t.y} y2={t.y} className="stroke-border" strokeWidth="1" />
            <text x={MARGIN.left - 6} y={t.y + 3.5} textAnchor="end" fontSize="10.5" className="fill-text-2">
              {formatAxis(t.value)}
            </text>
          </g>
        ))}

        {highlight !== undefined && highlight >= 0 && highlight < categories.length && (
          <rect
            x={layout.xCenter(highlight) - layout.band / 2}
            y={MARGIN.top}
            width={layout.band}
            height={layout.baseline - MARGIN.top}
            rx="6"
            className="fill-surface-2"
          />
        )}

        {layout.rects.map((r) => {
          const s = series[r.series];
          const fill = s.hatched ? `url(#${uid}-${s.key})` : undefined;
          const title = `${categories[r.cat]} · ${s.label}: ${formatValue(r.value)}`;
          const rounded = r.top && r.h > 4;
          const style = s.hatched ? { stroke: s.color, strokeWidth: 1.5 } : { fill: s.color };
          // kontrasztos módban (Profil → Megjelenés) a több tömör sorozat mintát is kap
          const overlay = multiSolid && !s.hatched ? textureFill(uid, solidIndex.get(r.series) ?? 0) : null;
          return (
            <g key={`${r.cat}-${r.series}`}>
              {rounded ? (
                <path d={topRoundedRect(r.x, r.y, r.w, r.h, 4)} fill={fill} style={style}>
                  <title>{title}</title>
                </path>
              ) : (
                <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={fill} style={style}>
                  <title>{title}</title>
                </rect>
              )}
              {overlay &&
                (rounded ? (
                  <path d={topRoundedRect(r.x, r.y, r.w, r.h, 4)} fill={overlay} className="chart-texture" pointerEvents="none" />
                ) : (
                  <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={overlay} className="chart-texture" pointerEvents="none" />
                ))}
            </g>
          );
        })}

        {average && average.value > 0 && (
          <line
            x1={MARGIN.left}
            x2={W - MARGIN.right}
            y1={layout.yOf(average.value)}
            y2={layout.yOf(average.value)}
            strokeWidth="1.5"
            strokeDasharray="5 4"
            className="stroke-text-2"
          />
        )}

        <line x1={MARGIN.left} x2={W - MARGIN.right} y1={layout.baseline} y2={layout.baseline} className="stroke-border" strokeWidth="1" />
        {categories.map((c, i) =>
          showLabel(i) ? (
            <text key={c + i} x={layout.xCenter(i)} y={H - 7} textAnchor="middle" fontSize="10.5" className={i === highlight ? "fill-text font-semibold" : "fill-text-2"}>
              {c}
            </text>
          ) : null,
        )}
      </svg>
      <ChartLegend
        items={[
          ...series.map((s, i) => ({ key: s.key, label: s.label, color: s.color, hatched: s.hatched, texture: multiSolid && !s.hatched ? solidIndex.get(i) : undefined })),
          ...(average && average.value > 0 ? [{ key: "avg", label: average.label, color: "var(--text-2)", dashed: true }] : []),
          ...legendExtra,
        ]}
      />
    </figure>
  );
}
