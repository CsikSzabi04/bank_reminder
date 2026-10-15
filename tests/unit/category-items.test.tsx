import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast";
import hu from "@/locales/hu.json";

// a szerver-akciókat és a routert kicseréljük: a lista megjelenését és a visszavonás adatait teszteljük
const state = vi.hoisted(() => ({
  deleteExpense: vi.fn(),
  restoreExpense: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/lib/budgets/actions", () => ({ deleteExpense: state.deleteExpense, restoreExpense: state.restoreExpense }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: state.refresh, push: vi.fn(), replace: vi.fn() }) }));

import { CategoryItems, type ItemView } from "@/components/budgets/category-items";

afterEach(cleanup);
beforeEach(() => {
  state.deleteExpense.mockReset().mockResolvedValue({ ok: true });
  state.restoreExpense.mockReset().mockResolvedValue({ ok: true, data: { id: "new" } });
  state.refresh.mockReset();
});

const CAT = "0b3f8a55-62c1-4a6e-9c1b-1f2d3e4a5b6c";
const expense = (over: Partial<Extract<ItemView, { kind: "expense" }>>): ItemView => ({
  kind: "expense",
  id: "e1",
  name: "Pizzéria",
  date: "2026-10-10",
  amount: 4500,
  currency: "HUF",
  source: "manual",
  provisional: false,
  note: null,
  merchant: null,
  ...over,
});

function setup(items: ItemView[]) {
  render(
    <NextIntlClientProvider locale="hu" messages={hu}>
      <ToastProvider>
        <CategoryItems items={items} categoryId={CAT} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
  return userEvent.setup();
}

describe("CategoryItems — automatikus / ideiglenes jelvény (B-45)", () => {
  it("kézi tételen nincs jelvény", () => {
    setup([expense({})]);
    expect(screen.queryByText("Automatikus")).toBeNull();
    expect(screen.queryByText("Ideiglenes")).toBeNull();
  });

  it("banki tétel: „Automatikus”; értesítés-eredetű ideiglenes: „Automatikus” + „Ideiglenes” — szöveggel, nem csak színnel", () => {
    setup([expense({ id: "b", source: "bank", name: "Bolt" }), expense({ id: "n", source: "notification", provisional: true, name: "Étterem" })]);
    const bank = screen.getByText("Bolt").closest("li")!;
    expect(within(bank).getByText("Automatikus")).toBeInTheDocument();
    expect(within(bank).queryByText("Ideiglenes")).toBeNull();
    const note = screen.getByText("Étterem").closest("li")!;
    expect(within(note).getByText("Automatikus")).toBeInTheDocument();
    expect(within(note).getByText("Ideiglenes")).toBeInTheDocument();
  });
});

describe("CategoryItems — törlés visszavonással (B-45)", () => {
  it("törlés után a „Visszavonás” ugyanazokkal az adatokkal újra felveszi a tételt (kereskedővel és megjegyzéssel)", async () => {
    const user = setup([expense({ source: "notification", provisional: true, merchant: "Pizzéria", note: "ebéd" })]);
    await user.click(screen.getByRole("button", { name: /törlése/ }));
    await waitFor(() => expect(state.deleteExpense).toHaveBeenCalledWith("e1"));
    await user.click(await screen.findByRole("button", { name: "Visszavonás" }));
    await waitFor(() =>
      expect(state.restoreExpense).toHaveBeenCalledWith({ amount: 4500, currency: "HUF", spentOn: "2026-10-10", categoryId: CAT, note: "ebéd", merchant: "Pizzéria" }),
    );
    expect(await screen.findByText("A kiadás visszaállítva.")).toBeInTheDocument();
  });

  it("sikertelen törlésnél nincs visszavonás-felajánlás, és a hiba látszik", async () => {
    state.deleteExpense.mockResolvedValue({ ok: false, code: "upstream_failed" });
    const user = setup([expense({})]);
    await user.click(screen.getByRole("button", { name: /törlése/ }));
    expect(await screen.findByText("A kiadást nem sikerült törölni.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Visszavonás" })).toBeNull();
    expect(state.restoreExpense).not.toHaveBeenCalled();
  });

  it("sikertelen visszaállításnál hiba-üzenet jelenik meg", async () => {
    state.restoreExpense.mockResolvedValue({ ok: false, code: "upstream_failed" });
    const user = setup([expense({})]);
    await user.click(screen.getByRole("button", { name: /törlése/ }));
    await user.click(await screen.findByRole("button", { name: "Visszavonás" }));
    expect(await screen.findByText("A kiadást nem sikerült visszaállítani.")).toBeInTheDocument();
  });
});
