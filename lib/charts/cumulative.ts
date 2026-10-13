import { linear, linePath, ticks } from "./axes";
import type { Margin } from "./stacked";

// A hónap lefutása (C3): két kumulatív vonal ugyanazon a skálán. A `prev` null értékei (rövidebb előző hónap) megszakítják a vonalat.
export function layoutCumulative(input: {
  days: number;
  current: ReadonlyArray<number>;
  previous: ReadonlyArray<number | null>;
  width: number;
  height: number;
  margin: Margin;
}) {
  const { days, current, previous, width, height, margin } = input;
  const axis = ticks(Math.max(0, ...current, ...previous.map((v) => v ?? 0)), 4);
  const yMax = axis[axis.length - 1];
  const x = linear(0, Math.max(1, days - 1), margin.left, width - margin.right);
  const y = linear(0, yMax, height - margin.bottom, margin.top);
  const cur = current.map((v, i) => [x(i), y(v)] as const);
  // az előző hónap szakaszai: összefüggő, nem null értékek
  const segments: Array<Array<readonly [number, number]>> = [];
  previous.forEach((v, i) => {
    if (v === null) return;
    if (previous[i - 1] === null || i === 0) segments.push([]);
    segments[segments.length - 1].push([x(i), y(v)] as const);
  });
  return {
    currentPath: linePath(cur),
    // terület a vonal alatt
    areaPath: cur.length ? `${linePath(cur)}L${Number(cur[cur.length - 1][0].toFixed(2))} ${height - margin.bottom}L${Number(cur[0][0].toFixed(2))} ${height - margin.bottom}Z` : "",
    previousPaths: segments.filter((s) => s.length > 1).map(linePath),
    ticks: axis.map((value) => ({ value, y: y(value) })),
    x,
    y,
    last: cur[cur.length - 1] ?? null,
  };
}
