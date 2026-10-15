import { BANK_CONSENT_NOTIFY_DAYS_BEFORE } from "@/lib/constants";
import { daysUntil } from "@/lib/due";
import { todayIn } from "@/lib/format";
import { addDays } from "@/lib/tz";

// A bank-hozzáférés lejárat-értesítéseinek ütemterve (advanced.md §6). Tiszta számítás: a szerver
// `consent_valid_until`-jából (a bank tényleges lejárata, nem feltételezett 180 nap) és a mai napból dolgozik.
export type ConsentStepState = "sent" | "next" | "upcoming";
export type ConsentStep = {
  daysBefore: number;
  date: string; // "YYYY-MM-DD" a profil időzónájában
  state: ConsentStepState;
};

type ScheduleInput = {
  validUntil: string | Date;
  authorizedAt: string | Date;
  timeZone: string;
  now?: Date;
};

const dayIn = (instant: string | Date, timeZone: string) => todayIn(timeZone, new Date(instant));

// A lejárat napja a profil időzónájában (az UTC-dátum éjfél körül egy nappal eltérhet)
export function consentExpiryDay(validUntil: string | Date, timeZone: string): string {
  return dayIn(validUntil, timeZone);
}

// Hátralévő naptári napok (a lejárat napján 0, utána negatív)
export function consentDaysLeft({ validUntil, timeZone, now = new Date() }: Pick<ScheduleInput, "validUntil" | "timeZone" | "now">): number {
  return daysUntil(consentExpiryDay(validUntil, timeZone), todayIn(timeZone, now));
}

// Az engedélyezés napja előtti lépés sosem létezett (rövid, pl. 14 napos hozzáférésnél a 30/23/16 napos kimarad).
// Az állapot a naptári napból jön: a mai nap előtti lépés „elküldve", az első hátralévő „következő".
export function consentSchedule({ validUntil, authorizedAt, timeZone, now = new Date() }: ScheduleInput): ConsentStep[] {
  const expiry = consentExpiryDay(validUntil, timeZone);
  const authorized = dayIn(authorizedAt, timeZone);
  const today = todayIn(timeZone, now);

  const dated = BANK_CONSENT_NOTIFY_DAYS_BEFORE.map((daysBefore) => ({ daysBefore, date: addDays(expiry, -daysBefore) }))
    .filter((step) => step.date >= authorized)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  let nextAssigned = false;
  return dated.map((step) => {
    if (step.date < today) return { ...step, state: "sent" as const };
    if (!nextAssigned) {
      nextAssigned = true;
      return { ...step, state: "next" as const };
    }
    return { ...step, state: "upcoming" as const };
  });
}
