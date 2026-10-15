// Textúrák a „Kontrasztosabb diagramok" beállításhoz (§15.5): a szín mellett minta is jelzi a szeletet/sorozatot.
// Az átfedő elemek `chart-texture` osztályúak: alapból rejtettek, a `html[data-contrast-charts="1"]` mutatja (CSS, nincs újrarenderelés).
export const TEXTURE_COUNT = 4;

export const textureFill = (prefix: string, index: number) => `url(#${prefix}-t${index % TEXTURE_COUNT})`;

export function TextureDefs({ prefix }: { prefix: string }) {
  const line = { strokeWidth: 2.2, opacity: 0.8, className: "stroke-surface" } as const;
  return (
    <defs>
      <pattern id={`${prefix}-t0`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" {...line} />
      </pattern>
      <pattern id={`${prefix}-t1`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
        <line x1="0" y1="0" x2="0" y2="6" {...line} />
      </pattern>
      <pattern id={`${prefix}-t2`} width="7" height="7" patternUnits="userSpaceOnUse">
        <circle cx="3.5" cy="3.5" r="1.4" className="fill-surface" opacity="0.85" />
      </pattern>
      <pattern id={`${prefix}-t3`} width="7" height="7" patternUnits="userSpaceOnUse">
        <line x1="0" y1="3.5" x2="7" y2="3.5" {...line} />
        <line x1="3.5" y1="0" x2="3.5" y2="7" {...line} />
      </pattern>
    </defs>
  );
}
