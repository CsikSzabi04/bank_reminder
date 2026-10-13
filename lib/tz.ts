// Időzóna-segédek a profil időzónájához (ADR-15): a naptári nap + helyi idő → UTC időpont.

// Az időzóna UTC-től való eltérése (ms) az adott pillanatban; a DST-t az Intl kezeli
function offsetMs(timeZone: string, instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

// "2026-10-13" + "09:00" a "Europe/Budapest" zónában → a megfelelő UTC pillanat.
// Kétlépéses közelítés: a DST-határ közelében is a helyes (nem létező órát a következőre igazítja).
export function zonedTimeToUtc(isoDate: string, time: string, timeZone: string): Date {
  const [y, mo, d] = isoDate.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const naive = Date.UTC(y, mo - 1, d, hh, mm);
  let guess = naive - offsetMs(timeZone, new Date(naive));
  guess = naive - offsetMs(timeZone, new Date(guess));
  return new Date(guess);
}

// "YYYY-MM-DD" + n nap (naptári nap-aritmetika, időzónától független)
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
