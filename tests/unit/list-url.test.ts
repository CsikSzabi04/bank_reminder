import { describe, expect, it } from "vitest";
import { listHref } from "@/lib/reminders/list-url";
import { QUICK_ADD, quickAddHref } from "@/lib/reminders/quick-add";

describe("listHref (a lista állapota az URL-ben)", () => {
  it("alapértékek nem kerülnek az URL-be", () => {
    expect(listHref({})).toBe("/reminders");
    expect(listHref({ filter: "all", sort: "due", q: "" })).toBe("/reminders");
    expect(listHref({ q: "   " })).toBe("/reminders");
  });
  it("nem-alapértékek megmaradnak, a keresés trimmelve és kódolva", () => {
    expect(listHref({ filter: "subscriptions" })).toBe("/reminders?filter=subscriptions");
    expect(listHref({ sort: "amount", q: " áram & gáz " })).toBe("/reminders?sort=amount&q=%C3%A1ram+%26+g%C3%A1z");
    expect(listHref({ filter: "overdue", sort: "name", q: "x" })).toBe("/reminders?filter=overdue&sort=name&q=x");
  });
});

describe("quickAddHref", () => {
  it("márka: a katalógus-slug megy, a név a katalógusból jön", () => {
    expect(quickAddHref({ kind: "brand", name: "Netflix", service: "netflix" }, "Netflix")).toBe("/reminders/new?service=netflix");
  });
  it("általános tétel: a lefordított név és a kategória-kulcs megy (kódolva)", () => {
    expect(quickAddHref({ kind: "generic", labelKey: "electricity", category: "utilities" }, "Áram")).toBe(
      "/reminders/new?name=%C3%81ram&category=utilities",
    );
  });
  it("minden gyors-hozzáadás tétel érvényes linket ad", () => {
    for (const item of QUICK_ADD) {
      const href = quickAddHref(item, item.kind === "brand" ? item.name : "x");
      expect(href.startsWith("/reminders/new?")).toBe(true);
    }
  });
});
