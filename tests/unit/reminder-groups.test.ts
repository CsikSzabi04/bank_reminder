import { describe, expect, it } from "vitest";
import {
  endOfWeek,
  filterItems,
  groupItems,
  groupOf,
  sortItems,
  type ListItem,
  type ListReminder,
} from "@/lib/reminders/group";

const TODAY = "2026-10-13"; // kedd

function item(name: string, due: string | null, over: Partial<ListReminder> = {}, amount = 1000): ListItem {
  return {
    reminder: {
      id: name,
      name,
      amount,
      currency: "HUF",
      category_id: null,
      is_subscription: false,
      recur_unit: "month",
      recur_every: 1,
      start_date: "2026-01-01",
      month_end: false,
      remind_enabled: true,
      is_active: true,
      is_demo: false,
      url: null,
      ...over,
    },
    next: due ? { id: `o-${name}`, due_date: due, amount, currency: "HUF" } : null,
  };
}

describe("endOfWeek (hétfő az első nap)", () => {
  it("hét vasárnapja", () => {
    expect(endOfWeek("2026-10-13")).toBe("2026-10-18"); // kedd → vasárnap
    expect(endOfWeek("2026-10-12")).toBe("2026-10-18"); // hétfő
    expect(endOfWeek("2026-10-18")).toBe("2026-10-18"); // vasárnap: önmaga
    expect(endOfWeek("2026-12-30")).toBe("2027-01-03"); // évhatár
  });
});

describe("groupOf", () => {
  it("lejárt: ma előtt", () => {
    expect(groupOf(item("a", "2026-10-12"), TODAY)).toBe("overdue");
  });
  it("ezen a héten: ma … vasárnap", () => {
    expect(groupOf(item("a", "2026-10-13"), TODAY)).toBe("thisWeek");
    expect(groupOf(item("a", "2026-10-18"), TODAY)).toBe("thisWeek");
  });
  it("később ebben a hónapban / jövő hónap / később", () => {
    expect(groupOf(item("a", "2026-10-19"), TODAY)).toBe("laterThisMonth");
    expect(groupOf(item("a", "2026-10-31"), TODAY)).toBe("laterThisMonth");
    expect(groupOf(item("a", "2026-11-01"), TODAY)).toBe("nextMonth");
    expect(groupOf(item("a", "2026-11-30"), TODAY)).toBe("nextMonth");
    expect(groupOf(item("a", "2026-12-01"), TODAY)).toBe("later");
  });
  it("évhatár: decemberben a január a jövő hónap", () => {
    expect(groupOf(item("a", "2027-01-05"), "2026-12-20")).toBe("nextMonth");
    expect(groupOf(item("a", "2027-02-05"), "2026-12-20")).toBe("later");
  });
  it("szüneteltetett és lezárt (nincs következő esedékesség)", () => {
    expect(groupOf(item("a", "2026-10-14", { is_active: false }), TODAY)).toBe("paused");
    expect(groupOf(item("a", null), TODAY)).toBe("done");
    // a szüneteltetett akkor is szüneteltetett, ha nincs dátuma
    expect(groupOf(item("a", null, { is_active: false }), TODAY)).toBe("paused");
  });
});

describe("filterItems", () => {
  const items = [
    item("Áram", "2026-10-20"),
    item("Netflix", "2026-10-14", { is_subscription: true }),
    item("Albérlet", "2026-10-10"),
    item("Régi", "2026-10-01", { is_active: false }),
  ];
  const names = (list: ListItem[]) => list.map((i) => i.reminder.name);

  it("számlák / előfizetések", () => {
    expect(names(filterItems(items, { filter: "bills", q: "" }, TODAY))).toEqual(["Áram", "Albérlet", "Régi"]);
    expect(names(filterItems(items, { filter: "subscriptions", q: "" }, TODAY))).toEqual(["Netflix"]);
  });
  it("lejárt: csak az aktív, lejárt tételek (a szüneteltetett nem)", () => {
    expect(names(filterItems(items, { filter: "overdue", q: "" }, TODAY))).toEqual(["Albérlet"]);
  });
  it("keresés ékezet- és kisbetű-független", () => {
    expect(names(filterItems(items, { filter: "all", q: "aram" }, TODAY))).toEqual(["Áram"]);
    expect(names(filterItems(items, { filter: "all", q: "  ALBERLET " }, TODAY))).toEqual(["Albérlet"]);
    expect(names(filterItems(items, { filter: "all", q: "nincs" }, TODAY))).toEqual([]);
  });
  it("szűrő + keresés együtt", () => {
    expect(names(filterItems(items, { filter: "bills", q: "ár" }, TODAY))).toEqual(["Áram"]);
  });
});

describe("sortItems", () => {
  const items = [
    item("Zöld", "2026-10-20", {}, 500),
    item("Alma", "2026-10-14", {}, 9000),
    item("Barack", "2026-10-14", {}, 100),
    item("Szünetel", null, { is_active: false }, 50),
  ];
  const names = (list: ListItem[]) => list.map((i) => i.reminder.name);

  it("esedékesség szerint, egyezésnél név; a dátum nélküliek a végén", () => {
    expect(names(sortItems(items, "due", "hu"))).toEqual(["Alma", "Barack", "Zöld", "Szünetel"]);
  });
  it("összeg szerint csökkenően", () => {
    expect(names(sortItems(items, "amount", "hu"))).toEqual(["Alma", "Zöld", "Barack", "Szünetel"]);
  });
  it("név szerint (magyar ABC: az ékezetes betű a párja mellett)", () => {
    expect(names(sortItems([item("Ősz", "2026-10-14"), item("Olaj", "2026-10-14"), item("Pál", "2026-10-14")], "name", "hu"))).toEqual([
      "Olaj",
      "Ősz",
      "Pál",
    ]);
  });
  it("nem módosítja a bemenetet", () => {
    const copy = [...items];
    sortItems(items, "name", "hu");
    expect(items).toEqual(copy);
  });
});

describe("groupItems", () => {
  it("minden elem pontosan egy csoportba kerül", () => {
    const items = [item("a", "2026-10-01"), item("b", "2026-10-14"), item("c", "2026-12-24"), item("d", null), item("e", "2026-10-30", { is_active: false })];
    const groups = groupItems(items, TODAY);
    const total = Object.values(groups).reduce((n, g) => n + g.length, 0);
    expect(total).toBe(items.length);
    expect(groups.overdue.map((i) => i.reminder.name)).toEqual(["a"]);
    expect(groups.thisWeek.map((i) => i.reminder.name)).toEqual(["b"]);
    expect(groups.later.map((i) => i.reminder.name)).toEqual(["c"]);
    expect(groups.done.map((i) => i.reminder.name)).toEqual(["d"]);
    expect(groups.paused.map((i) => i.reminder.name)).toEqual(["e"]);
  });
});
