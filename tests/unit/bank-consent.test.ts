import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { consentDaysLeft, consentExpiryDay, consentSchedule } from "@/lib/bank/consent";
import { BANK_CONSENT_NOTIFY_DAYS_BEFORE } from "@/lib/constants";
import { daysUntil } from "@/lib/due";

const BP = "Europe/Budapest";
const at = (iso: string) => new Date(iso);

// A migrációban keresett lista: a konstans neve után, ugyanabban a sorban ARRAY[30,23,…] · '{30,23,…}' · [30, 23, …]
function findSqlList(sql: string): number[] | null {
  const hit = /bank_consent_notify_days_before[^\n]{0,80}?(?:array\s*\[|\{|\[)\s*([\d\s,]+?)\s*(?:\]|\})/i.exec(sql)?.[1];
  return hit ? hit.split(",").map((n) => Number(n.trim())) : null;
}

describe("BANK_CONSENT_NOTIFY_DAYS_BEFORE (advanced.md §6)", () => {
  it("pontosan a 7 kötelező lépés: 30/23/16/9/2/1/0 nappal a lejárat előtt", () => {
    expect([...BANK_CONSENT_NOTIFY_DAYS_BEFORE]).toEqual([30, 23, 16, 9, 2, 1, 0]);
  });

  it("a migráció-kereső felismeri az ARRAY / kapcsos / szögletes alakot, másra nem reagál", () => {
    const want = [30, 23, 16, 9, 2, 1, 0];
    expect(findSqlList("-- BANK_CONSENT_NOTIFY_DAYS_BEFORE = [30, 23, 16, 9, 2, 1, 0]")).toEqual(want);
    expect(findSqlList("bank_consent_notify_days_before constant int[] := ARRAY[30,23,16,9,2,1,0];")).toEqual(want);
    expect(findSqlList("bank_consent_notify_days_before := '{30,23,16,9,2,1,0}'")).toEqual(want);
    expect(findSqlList("create table t (days int[]); -- 30, 23, 16")).toBeNull();
  });

  // Az SQL-oldali lista (A-49: rebuild_bank_consent_notifications) egy migrációban él; a két lista nem térhet el.
  // Amíg az A-49 nincs fent, a teszt kimarad (a névben jelezve) — utána automatikusan élesedik.
  const dir = join(process.cwd(), "supabase", "migrations");
  const sqlList =
    readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => findSqlList(readFileSync(join(dir, f), "utf8")))
      .find(Boolean) ?? null;

  (sqlList ? it : it.skip)(`paritás: az SQL-lista egyezik${sqlList ? "" : " (az A-49 SQL-je még nincs fent)"}`, () => {
    expect(sqlList).toEqual([...BANK_CONSENT_NOTIFY_DAYS_BEFORE]);
  });
});

describe("consentSchedule", () => {
  it("180 napos hozzáférés: a lépések az engedélyezéstől számolva a 150/157/164/171/178/179/180. napon vannak", () => {
    const validUntil = "2026-10-15T08:00:00Z";
    const authorizedAt = "2026-04-18T08:00:00Z"; // 180 nappal korábban
    const steps = consentSchedule({ validUntil, authorizedAt, timeZone: BP, now: at("2026-04-19T10:00:00Z") });
    const authorizedDay = consentExpiryDay(authorizedAt, BP);
    expect(steps.map((s) => daysUntil(s.date, authorizedDay))).toEqual([150, 157, 164, 171, 178, 179, 180]);
    expect(steps.map((s) => s.daysBefore)).toEqual([30, 23, 16, 9, 2, 1, 0]);
    expect(steps.at(-1)?.date).toBe("2026-10-15");
  });

  it("90 napos hozzáférésnél is mind a 7 lépés megvan (a 30 napos az 60. napra esik)", () => {
    const steps = consentSchedule({
      validUntil: "2026-10-15T08:00:00Z",
      authorizedAt: "2026-07-17T08:00:00Z",
      timeZone: BP,
      now: at("2026-07-17T10:00:00Z"),
    });
    expect(steps).toHaveLength(7);
    expect(steps[0].date).toBe("2026-09-15");
  });

  it("rövid (14 napos) hozzáférésnél a lejárat előtti 30/23/16 napos lépés kimarad", () => {
    const steps = consentSchedule({
      validUntil: "2026-10-15T08:00:00Z",
      authorizedAt: "2026-10-01T08:00:00Z",
      timeZone: BP,
      now: at("2026-10-01T10:00:00Z"),
    });
    expect(steps.map((s) => s.daysBefore)).toEqual([9, 2, 1, 0]);
  });

  it("állapot: a mai nap előtti elküldve, az első hátralévő következő, a többi várható", () => {
    const steps = consentSchedule({
      validUntil: "2026-10-15T08:00:00Z",
      authorizedAt: "2026-04-18T08:00:00Z",
      timeZone: BP,
      now: at("2026-10-07T10:00:00Z"), // 8 nap van hátra: a 9 napos lépés (okt. 6.) elmúlt
    });
    expect(steps.map((s) => [s.daysBefore, s.state])).toEqual([
      [30, "sent"],
      [23, "sent"],
      [16, "sent"],
      [9, "sent"],
      [2, "next"],
      [1, "upcoming"],
      [0, "upcoming"],
    ]);
  });

  it("a lépés napján a lépés még „következő” (az ma esedékes), másnap már „elküldve”", () => {
    const base = { validUntil: "2026-10-15T08:00:00Z", authorizedAt: "2026-04-18T08:00:00Z", timeZone: BP };
    const onDay = consentSchedule({ ...base, now: at("2026-10-13T10:00:00Z") }); // a 2 napos lépés napja
    expect(onDay.find((s) => s.daysBefore === 2)?.state).toBe("next");
    const after = consentSchedule({ ...base, now: at("2026-10-14T10:00:00Z") });
    expect(after.find((s) => s.daysBefore === 2)?.state).toBe("sent");
    expect(after.find((s) => s.daysBefore === 1)?.state).toBe("next");
  });

  it("lejárt hozzáférés: minden lépés elküldve, nincs következő", () => {
    const steps = consentSchedule({
      validUntil: "2026-10-15T08:00:00Z",
      authorizedAt: "2026-04-18T08:00:00Z",
      timeZone: BP,
      now: at("2026-10-20T10:00:00Z"),
    });
    expect(steps.every((s) => s.state === "sent")).toBe(true);
  });

  it("a lejárat napja a profil időzónájában számít, nem az UTC-ben (éjfél körül egy nappal eltér)", () => {
    // 2026-10-15 22:30 UTC = 2026-10-16 00:30 Budapest (CEST, UTC+2)
    expect(consentExpiryDay("2026-10-15T22:30:00Z", BP)).toBe("2026-10-16");
    expect(consentExpiryDay("2026-10-15T22:30:00Z", "UTC")).toBe("2026-10-15");
    const steps = consentSchedule({
      validUntil: "2026-10-15T22:30:00Z",
      authorizedAt: "2026-04-01T08:00:00Z",
      timeZone: BP,
      now: at("2026-10-01T10:00:00Z"),
    });
    expect(steps.at(-1)?.date).toBe("2026-10-16");
  });

  it("érvénytelen sorrend (a lejárat az engedélyezés előtt) nem ad lépést", () => {
    expect(
      consentSchedule({ validUntil: "2026-01-01T00:00:00Z", authorizedAt: "2026-06-01T00:00:00Z", timeZone: BP, now: at("2026-06-02T00:00:00Z") }),
    ).toEqual([]);
  });
});

describe("consentDaysLeft", () => {
  it("naptári napok a lejáratig; a lejárat napján 0, utána negatív", () => {
    const validUntil = "2026-10-15T08:00:00Z";
    expect(consentDaysLeft({ validUntil, timeZone: BP, now: at("2026-09-15T10:00:00Z") })).toBe(30);
    expect(consentDaysLeft({ validUntil, timeZone: BP, now: at("2026-10-15T20:00:00Z") })).toBe(0);
    expect(consentDaysLeft({ validUntil, timeZone: BP, now: at("2026-10-17T10:00:00Z") })).toBe(-2);
  });
});
