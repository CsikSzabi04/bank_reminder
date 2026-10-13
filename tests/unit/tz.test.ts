import { describe, expect, it } from "vitest";
import { addDays, zonedTimeToUtc } from "@/lib/tz";

const BUD = "Europe/Budapest";

describe("zonedTimeToUtc (§8.4 — DST-helyes)", () => {
  it("nyári időben UTC+2, télin UTC+1", () => {
    expect(zonedTimeToUtc("2026-10-13", "09:00", BUD).toISOString()).toBe("2026-10-13T07:00:00.000Z");
    expect(zonedTimeToUtc("2026-11-10", "09:00", BUD).toISOString()).toBe("2026-11-10T08:00:00.000Z");
  });

  it("az óraátállítás körüli napokon is a helyi 09:00-t adja", () => {
    // 2026-10-25: téli időszámításra állunk át (03:00 → 02:00)
    expect(zonedTimeToUtc("2026-10-24", "09:00", BUD).toISOString()).toBe("2026-10-24T07:00:00.000Z");
    expect(zonedTimeToUtc("2026-10-25", "09:00", BUD).toISOString()).toBe("2026-10-25T08:00:00.000Z");
    // 2026-03-29: nyári időszámításra állunk át
    expect(zonedTimeToUtc("2026-03-28", "09:00", BUD).toISOString()).toBe("2026-03-28T08:00:00.000Z");
    expect(zonedTimeToUtc("2026-03-29", "09:00", BUD).toISOString()).toBe("2026-03-29T07:00:00.000Z");
  });

  it("nem létező helyi időnél (átállás) sem dob hibát, és ésszerű pillanatot ad", () => {
    const d = zonedTimeToUtc("2026-03-29", "02:30", BUD);
    expect(Number.isNaN(d.getTime())).toBe(false);
    expect(Math.abs(d.getTime() - Date.parse("2026-03-29T01:00:00Z"))).toBeLessThan(2 * 3_600_000);
  });

  it("más zónák: UTC, New York (DST), Auckland", () => {
    expect(zonedTimeToUtc("2026-10-13", "09:00", "UTC").toISOString()).toBe("2026-10-13T09:00:00.000Z");
    expect(zonedTimeToUtc("2026-10-13", "09:00", "America/New_York").toISOString()).toBe("2026-10-13T13:00:00.000Z");
    expect(zonedTimeToUtc("2026-10-13", "09:00", "Pacific/Auckland").toISOString()).toBe("2026-10-12T20:00:00.000Z");
  });
});

describe("addDays", () => {
  it("naptári nap-aritmetika hónap- és évhatáron", () => {
    expect(addDays("2026-10-13", 1)).toBe("2026-10-14");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-10-13", 7)).toBe("2026-10-20");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});
