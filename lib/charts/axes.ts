// Tengely-segédek a diagramokhoz (tiszta függvények). Az értékeket az SQL adja (H9); itt csak a rajzhoz skálázunk.

// A tengely teteje: a legközelebbi „szép" érték (1 / 2 / 2,5 / 5 / 10 × 10^n) a maximum fölött
export function niceMax(max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 1;
  const exp = Math.floor(Math.log10(max));
  const base = 10 ** exp;
  const frac = max / base;
  const step = [1, 2, 2.5, 5, 10].find((s) => frac <= s + 1e-9) ?? 10;
  return step * base;
}

// 0-tól niceMax-ig `count` egyenlő köz → count + 1 osztásérték
export function ticks(max: number, count = 4): number[] {
  const top = niceMax(max);
  return Array.from({ length: count + 1 }, (_, i) => (top * i) / count);
}

// Lineáris leképezés [d0, d1] → [r0, r1]; elfajult tartománynál (d0 = d1) a tartomány közepe
export function linear(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
  if (d1 === d0) return () => (r0 + r1) / 2;
  return (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
}

// Felül lekerekített téglalap (halmozott oszlop felső szegmense); a sugár nem lehet nagyobb a fél szélességnél / magasságnál
export function topRoundedRect(x: number, y: number, w: number, h: number, r: number): string {
  const rad = Math.max(0, Math.min(r, w / 2, h));
  const f = (n: number) => Number(n.toFixed(2));
  return `M${f(x)} ${f(y + h)}V${f(y + rad)}Q${f(x)} ${f(y)} ${f(x + rad)} ${f(y)}H${f(x + w - rad)}Q${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + rad)}V${f(y + h)}Z`;
}

// Vonal-útvonal pontokból (M/L)
export function linePath(points: ReadonlyArray<readonly [number, number]>): string {
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${Number(x.toFixed(2))} ${Number(y.toFixed(2))}`).join("");
}

// „Sűrű napok": ha a legsűrűbb 3 egymás utáni nap az időszak összegének legalább `minShare`-ét adja, a három nap indexe.
// Ha az összeg 0 vagy kevesebb mint 3 nap van, nincs sűrű nap.
export function denseDays(totals: readonly number[], minShare = 0.4, span = 3): Set<number> {
  const sum = totals.reduce((a, b) => a + b, 0);
  if (sum <= 0 || totals.length < span) return new Set();
  let best = -1;
  let bestStart = 0;
  for (let i = 0; i + span <= totals.length; i++) {
    const w = totals.slice(i, i + span).reduce((a, b) => a + b, 0);
    if (w > best) {
      best = w;
      bestStart = i;
    }
  }
  if (best / sum < minShare) return new Set();
  // a nulla összegű napokat nem jelöljük
  return new Set(Array.from({ length: span }, (_, k) => bestStart + k).filter((i) => totals[i] > 0));
}
