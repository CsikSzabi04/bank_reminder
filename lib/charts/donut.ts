// Fánkdiagram geometria (tiszta függvények, SVG-hez). A szeletek értékeit az SQL adja (dashboard_summary);
// itt csak arányokat számolunk a rajzoláshoz — összeget nem (H9).

export type DonutInput = { key: string; value: number };
export type DonutArc = {
  key: string;
  value: number;
  /** a teljes körhöz mért arány (0–1) */
  share: number;
  /** SVG path a körgyűrű szeletéhez */
  path: string;
};

const TAU = Math.PI * 2;

function point(cx: number, cy: number, r: number, angle: number): [number, number] {
  // 0 = fent (12 óra), az óramutató járása szerint
  return [cx + r * Math.sin(angle), cy - r * Math.cos(angle)];
}

const fmt = (n: number) => Number(n.toFixed(3));

function ringSlice(cx: number, cy: number, outer: number, inner: number, start: number, end: number): string {
  const [x1, y1] = point(cx, cy, outer, start);
  const [x2, y2] = point(cx, cy, outer, end);
  const [x3, y3] = point(cx, cy, inner, end);
  const [x4, y4] = point(cx, cy, inner, start);
  const large = end - start > Math.PI ? 1 : 0;
  return `M${fmt(x1)} ${fmt(y1)}A${outer} ${outer} 0 ${large} 1 ${fmt(x2)} ${fmt(y2)}L${fmt(x3)} ${fmt(y3)}A${inner} ${inner} 0 ${large} 0 ${fmt(x4)} ${fmt(y4)}Z`;
}

// Teljes gyűrű (egyetlen szelet): két félkör, mert egy 360°-os ív kezdő- és végpontja egybeesne
function fullRing(cx: number, cy: number, outer: number, inner: number): string {
  return (
    `M${cx} ${fmt(cy - outer)}A${outer} ${outer} 0 1 1 ${cx} ${fmt(cy + outer)}A${outer} ${outer} 0 1 1 ${cx} ${fmt(cy - outer)}Z` +
    `M${cx} ${fmt(cy - inner)}A${inner} ${inner} 0 1 0 ${cx} ${fmt(cy + inner)}A${inner} ${inner} 0 1 0 ${cx} ${fmt(cy - inner)}Z`
  );
}

/**
 * A szeletek ívei. A 0 vagy negatív értékű szeletek kimaradnak; üres bemenetnél üres lista.
 * `gap` (radián) a szeletek közötti rés (a felület-színű elválasztó, §15.4: 2 px).
 */
export function donutArcs(
  items: DonutInput[],
  { size, thickness, gap = 0.02 }: { size: number; thickness: number; gap?: number },
): DonutArc[] {
  const slices = items.filter((i) => i.value > 0);
  const total = slices.reduce((sum, i) => sum + i.value, 0);
  if (total <= 0) return [];

  const c = size / 2;
  const outer = c;
  const inner = c - thickness;

  if (slices.length === 1) {
    return [{ key: slices[0].key, value: slices[0].value, share: 1, path: fullRing(c, c, outer, inner) }];
  }

  let angle = 0;
  return slices.map((s) => {
    const span = (s.value / total) * TAU;
    // a rés nem ehet nagyobb a szelet felénél (apró szeletek ne tűnjenek el)
    const g = Math.min(gap, span / 2);
    const path = ringSlice(c, c, outer, inner, angle + g / 2, angle + span - g / 2);
    angle += span;
    return { key: s.key, value: s.value, share: s.value / total, path };
  });
}

// A fő ≤ `max` szelet + a többi „Egyéb" szeletbe olvasztva (diagramonként max. 7 csoport + Egyéb, §15.4)
export function collapseToOther<T extends DonutInput>(
  items: T[],
  max: number,
  otherKey: string,
  makeOther: (value: number) => T,
): T[] {
  const sorted = [...items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  if (sorted.length <= max) return sorted;
  const head = sorted.slice(0, max);
  const rest = sorted.slice(max).reduce((sum, i) => sum + i.value, 0);
  const existing = head.find((i) => i.key === otherKey);
  return existing ? head.map((i) => (i === existing ? makeOther(i.value + rest) : i)) : [...head, makeOther(rest)];
}
