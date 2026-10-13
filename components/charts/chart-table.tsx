// Táblázat-nézet (§15.5): a diagram adatai szövegesen, képernyőolvasó- és CVD-barát. A görgethető terület fókuszálható (axe).
export type ChartTableProps = {
  caption: string;
  columns: string[];
  rows: Array<{ label: string; cells: string[] }>;
};

export function ChartTable({ caption, columns, rows }: ChartTableProps) {
  return (
    <div role="region" aria-label={caption} tabIndex={0} className="overflow-x-auto rounded-control focus-visible:outline-2 focus-visible:outline-primary">
      <table className="w-full min-w-max border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border text-left text-text-2">
            {columns.map((c, i) => (
              <th key={c} scope="col" className={`py-2 pr-4 font-medium ${i > 0 ? "text-right" : ""}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-border/60 last:border-0">
              <th scope="row" className="py-2 pr-4 text-left font-medium">
                {r.label}
              </th>
              {r.cells.map((c, i) => (
                <td key={`${r.label}-${columns[i + 1]}`} className="py-2 pr-4 text-right tabular-nums">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
