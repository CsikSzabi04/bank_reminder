// Pénzösszegek összegzése lebegőpontos sodródás nélkül: centre kerekített egészekkel számolunk (numeric(14,2) értékek).
// Csak a költségkeret-összesítőhöz kell (a sorok összegét az SQL adja, az összesen-sort nem); egyébként az összegzés SQL-ben történik (H9).
export function sumMoney(values: ReadonlyArray<number>): number {
  return values.reduce((acc, v) => acc + Math.round(v * 100), 0) / 100;
}
