const MS_PER_DAY = 86_400_000;

// Naptári napok különbsége: dueDate − today (mindkettő "YYYY-MM-DD", a profil időzónájában értelmezett nap)
export function daysUntil(dueDate: string, today: string): number {
  return Math.round((Date.parse(`${dueDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / MS_PER_DAY);
}

export type DueTone = "overdue" | "soon" | "normal" | "paid" | "skipped" | "paused" | "done";

// A megjelenítés hangnemét a státusz és a hátralévő napok adják; a UI mindig ikon + szöveg is (nem csak szín)
export function dueTone(status: string, dueDate: string, today: string): DueTone {
  if (status === "paid") return "paid";
  if (status === "skipped") return "skipped";
  // emlékeztető-szintű állapotok (lista): szüneteltetett / nincs több esedékesség
  if (status === "paused") return "paused";
  if (status === "done") return "done";
  const days = daysUntil(dueDate, today);
  if (days < 0) return "overdue";
  return days <= 3 ? "soon" : "normal";
}

// A relatív szöveg ("holnap", "3 nap múlva") csak közeli dátumra szép; távolira a konkrét dátum
export const RELATIVE_LIMIT_DAYS = 14;
