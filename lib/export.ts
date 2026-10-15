// Adat-export segédek (§19.1 „Adataim"): CSV-építés, tábla-választás. Tiszta függvények (tesztelve).

export const CSV_TABLES = ["reminders", "occurrences", "expenses"] as const;
export type CsvTable = (typeof CSV_TABLES)[number];

export const isCsvTable = (v: string | null): v is CsvTable => (CSV_TABLES as readonly string[]).includes(v ?? "");

// Táblázatkezelőben megnyitva a „=", „+", „-", „@" (és tab/CR) kezdetű SZÖVEG képletként futna (CSV-injekció) → aposztróf-előtag.
// A számokat (pl. -5) nem érinti: azok nem szövegek.
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text: string;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "string") text = value;
  else text = JSON.stringify(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

// Sorok → CSV (RFC 4180, CRLF). Az oszlopok az első előfordulás sorrendjében az összes sor kulcs-uniója.
export function toCsv(rows: ReadonlyArray<Record<string, unknown>>): string {
  const columns: string[] = [];
  for (const row of rows) for (const key of Object.keys(row)) if (!columns.includes(key)) columns.push(key);
  const lines = [columns.map(csvCell).join(","), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(","))];
  return lines.join("\r\n") + "\r\n";
}

export function exportFilename(kind: "json" | CsvTable, exportedAt: string): string {
  const day = /^\d{4}-\d{2}-\d{2}/.exec(exportedAt)?.[0] ?? "export";
  return kind === "json" ? `bank-reminder-${day}.json` : `bank-reminder-${kind}-${day}.csv`;
}
