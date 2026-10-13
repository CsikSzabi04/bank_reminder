import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("@/utils/supabase/server", () => ({ createClient: () => ({}) }));

import { MAX_MONTH_OFFSET, resolveMonth, shiftMonth } from "@/lib/dashboard";

describe("shiftMonth", () => {
  it("hónap- és évhatáron is helyes", () => {
    expect(shiftMonth("2026-10-01", 1)).toBe("2026-11-01");
    expect(shiftMonth("2026-12-01", 1)).toBe("2027-01-01");
    expect(shiftMonth("2026-01-01", -1)).toBe("2025-12-01");
    expect(shiftMonth("2026-03-01", -13)).toBe("2025-02-01");
  });
});

describe("resolveMonth (?month= érvényesítés)", () => {
  const today = "2026-10-13";
  it("hiányzó vagy érvénytelen érték → az aktuális hónap", () => {
    for (const bad of [undefined, "", "abc", "2026-13", "2026-00", "2026-1", "2026-10-05", "26-10", "2026/10"]) {
      expect(resolveMonth(bad, today), String(bad)).toBe("2026-10-01");
    }
  });
  it("érvényes hónap a hónap első napjává alakul", () => {
    expect(resolveMonth("2026-09", today)).toBe("2026-09-01");
    expect(resolveMonth("2027-02", today)).toBe("2027-02-01");
  });
  it("a ±24 hónapon kívüli érték az aktuális hónapra esik vissza", () => {
    expect(resolveMonth("2024-10", today)).toBe("2024-10-01"); // pontosan -24
    expect(resolveMonth("2024-09", today)).toBe("2026-10-01"); // -25
    expect(resolveMonth("2028-10", today)).toBe("2028-10-01"); // +24
    expect(resolveMonth("2028-11", today)).toBe("2026-10-01"); // +25
    expect(MAX_MONTH_OFFSET).toBe(24);
  });
});
