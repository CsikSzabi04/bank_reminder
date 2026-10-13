// A hír képe csak https lehet (a betöltő is így szűri); minden más → nincs kép (téma-ikonos tartalék)
export function safeImageUrl(src: string | null | undefined): string | null {
  if (!src) return null;
  try {
    return new URL(src).protocol === "https:" ? src : null;
  } catch {
    return null;
  }
}
