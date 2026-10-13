import type { Locale } from "@/lib/i18n/config";

// Egyetlen formázó-forrás (§20.3). Összeget nem számolunk: a szerver (SQL) ad értéket, itt csak megjelenítünk (H9).
// Számokhoz en-US (kompakt "1.2M", nem "1.2m"), dátumhoz en-GB ("10 Nov 2026")
const NUM_LOCALE: Record<Locale, string> = { hu: "hu-HU", en: "en-US" };
const DATE_LOCALE: Record<Locale, string> = { hu: "hu-HU", en: "en-GB" };

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

function fractionDigits(currency: string): number {
  return currency === "HUF" ? 0 : 2;
}

export function formatMoney(amount: number, currency: string, locale: Locale): string {
  const digits = fractionDigits(currency);
  return new Intl.NumberFormat(NUM_LOCALE[locale], {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    // a magyar CLDR 4 számjegynél nem csoportosít ("2300"); a lista egységes: "2 300 Ft"
    useGrouping: "always",
  }).format(amount);
}

// Tengelyfeliratokhoz: 1,2 M Ft / HUF 1.2M
export function formatMoneyCompact(amount: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(NUM_LOCALE[locale], {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

// A `fraction` törtként érkezik: 0.31 → "31%"
export function formatPercent(fraction: number, locale: Locale): string {
  return new Intl.NumberFormat(NUM_LOCALE[locale], {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(fraction);
}

// "YYYY-MM-DD" naptári nap: időzónától független (UTC-éjfélként értelmezve, UTC-ben formázva).
// Időbélyeg (ISO / Date): a profil időzónájában formáz.
export function formatDate(value: string | Date, locale: Locale, timeZone: string): string {
  const isDateOnly = typeof value === "string" && DATE_ONLY.test(value);
  const date = isDateOnly ? new Date(`${value}T00:00:00Z`) : new Date(value);
  return new Intl.DateTimeFormat(DATE_LOCALE[locale], {
    dateStyle: "medium",
    timeZone: isDateOnly ? "UTC" : timeZone,
  }).format(date);
}

// A „ma" mindig a profil időzónájában értendő (nem a böngészőében, nem UTC) → "YYYY-MM-DD"
export function todayIn(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function dayNumber(isoDate: string): number {
  return Math.round(Date.parse(`${isoDate}T00:00:00Z`) / MS_PER_DAY);
}

// Naptári napok különbsége (due − today); a ma/holnap/tegnap szót az Intl adja (numeric: "auto")
export function formatRelativeDay(dueDate: string, today: string, locale: Locale): string {
  const diff = dayNumber(dueDate) - dayNumber(today);
  return new Intl.RelativeTimeFormat(DATE_LOCALE[locale], { numeric: "auto" }).format(diff, "day");
}

// Rövid dátum előnézetekhez ("nov. 10."); a napot nem csúsztatja az időzóna
export function formatShortDate(isoDate: string, locale: Locale): string {
  return new Intl.DateTimeFormat(DATE_LOCALE[locale], { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${isoDate}T00:00:00Z`),
  );
}

// "2026. október" / "October 2026" (a hónap első napjából); a napot nem csúsztatja az időzóna
export function formatMonth(isoDate: string, locale: Locale): string {
  return new Intl.DateTimeFormat(DATE_LOCALE[locale], { year: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${isoDate}T00:00:00Z`),
  );
}

// Időpont (óra:perc) a megadott időzónában: értesítés-listához
export function formatTime(value: string | Date, locale: Locale, timeZone: string): string {
  return new Intl.DateTimeFormat(DATE_LOCALE[locale], { hour: "2-digit", minute: "2-digit", timeZone, hourCycle: "h23" }).format(new Date(value));
}
