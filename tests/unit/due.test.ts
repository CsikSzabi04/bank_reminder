import { describe, expect, it } from "vitest";
import { daysUntil, dueTone } from "@/lib/due";

describe("daysUntil", () => {
  it("naptári napok különbsége, óraátállítás és hónaphatár mellett is", () => {
    expect(daysUntil("2026-10-14", "2026-10-13")).toBe(1);
    expect(daysUntil("2026-10-13", "2026-10-13")).toBe(0);
    expect(daysUntil("2026-10-10", "2026-10-13")).toBe(-3);
    expect(daysUntil("2026-10-26", "2026-10-25")).toBe(1); // az óraátállítás napja
    expect(daysUntil("2026-11-02", "2026-10-30")).toBe(3);
  });
});

describe("dueTone", () => {
  const today = "2026-10-13";
  it("kifizetett és kihagyott függetlenül a dátumtól", () => {
    expect(dueTone("paid", "2026-01-01", today)).toBe("paid");
    expect(dueTone("skipped", "2026-01-01", today)).toBe("skipped");
  });
  it("lejárt: tegnap vagy régebbi", () => {
    expect(dueTone("upcoming", "2026-10-12", today)).toBe("overdue");
  });
  it("hamarosan: ma … 3 nap; utána normál", () => {
    expect(dueTone("upcoming", "2026-10-13", today)).toBe("soon");
    expect(dueTone("upcoming", "2026-10-16", today)).toBe("soon");
    expect(dueTone("upcoming", "2026-10-17", today)).toBe("normal");
  });
});
