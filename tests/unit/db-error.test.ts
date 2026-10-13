import { afterEach, describe, expect, it, vi } from "vitest";
import { mapDbError } from "@/lib/reminders/db-error";

afterEach(() => vi.restoreAllMocks());

describe("mapDbError (CONTRACT_CHANGES hibakódok)", () => {
  it.each([
    ["28000", "unauthenticated"],
    ["42501", "forbidden"],
    ["P0002", "not_found"],
    ["22023", "validation"],
    ["23514", "validation"],
    ["23503", "validation"],
    ["23505", "conflict"],
    ["53400", "limit_reached"],
  ])("%s → %s", (sqlstate, code) => {
    expect(mapDbError({ code: sqlstate })).toEqual({ ok: false, code });
  });

  it("ismeretlen vagy hiányzó kód → unknown, a naplóba csak a kód kerül", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(mapDbError({ code: "XX000", message: "user@example.com" } as never)).toEqual({ ok: false, code: "unknown" });
    expect(mapDbError(null)).toEqual({ ok: false, code: "unknown" });
    expect(JSON.stringify(spy.mock.calls)).not.toContain("example.com");
  });
});
