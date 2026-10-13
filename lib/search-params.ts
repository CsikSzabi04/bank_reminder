// A Next searchParams értéke string | string[] | undefined; mi mindig az első értéket használjuk
export function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
