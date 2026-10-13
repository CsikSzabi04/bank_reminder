import { linear, ticks } from "./axes";

// Halmozott oszlopdiagram geometriája (C2, C5): sorozatok × kategóriák értékmátrixa → téglalapok.
// A sorozat 0 van legalul. A halmozott szegmensek között `segGap` px rés van (a felső szegmens kapja a rést).
export type Margin = { top: number; right: number; bottom: number; left: number };
export type StackRect = { cat: number; series: number; x: number; y: number; w: number; h: number; value: number; top: boolean };
export type StackLayout = {
  rects: StackRect[];
  ticks: Array<{ value: number; y: number }>;
  yMax: number;
  baseline: number;
  band: number;
  barW: number;
  xCenter: (cat: number) => number;
  yOf: (value: number) => number;
};

export function layoutStacked(input: {
  values: ReadonlyArray<ReadonlyArray<number>>;
  width: number;
  height: number;
  margin: Margin;
  tickCount?: number;
  segGap?: number;
  barRatio?: number;
}): StackLayout {
  const { values, width, height, margin, tickCount = 4, segGap = 2, barRatio = 0.62 } = input;
  const cats = values[0]?.length ?? 0;
  const totals = Array.from({ length: cats }, (_, c) => values.reduce((s, row) => s + (row[c] ?? 0), 0));
  const axis = ticks(Math.max(0, ...totals), tickCount);
  const yMax = axis[axis.length - 1];
  const baseline = height - margin.bottom;
  const yOf = linear(0, yMax, baseline, margin.top);
  const plotW = width - margin.left - margin.right;
  const band = cats > 0 ? plotW / cats : 0;
  const barW = band * barRatio;
  const xCenter = (c: number) => margin.left + band * c + band / 2;

  const rects: StackRect[] = [];
  for (let c = 0; c < cats; c++) {
    let acc = 0;
    // a „felső" jelölés az utolsó nem-nulla szegmensé (annak a teteje lekerekített)
    let topSeries = -1;
    values.forEach((row, s) => {
      if ((row[c] ?? 0) > 0) topSeries = s;
    });
    values.forEach((row, s) => {
      const v = row[c] ?? 0;
      if (v <= 0) return;
      const y0 = yOf(acc);
      const y1 = yOf(acc + v);
      const gap = acc > 0 ? segGap : 0;
      rects.push({ cat: c, series: s, x: xCenter(c) - barW / 2, y: y1, w: barW, h: Math.max(0, y0 - y1 - gap), value: v, top: s === topSeries });
      acc += v;
    });
  }
  return { rects, ticks: axis.map((value) => ({ value, y: yOf(value) })), yMax, baseline, band, barW, xCenter, yOf };
}
