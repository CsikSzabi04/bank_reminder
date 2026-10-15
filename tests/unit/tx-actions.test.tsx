import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast";
import hu from "@/locales/hu.json";

// a szerver-akciókat és a routert kicseréljük: a Tranzakciók lista soronkénti műveleteit teszteljük
const state = vi.hoisted(() => ({ classify: vi.fn(), dismiss: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/bank/rules-actions", () => ({ classifyBankTransaction: state.classify, dismissBankTransaction: state.dismiss }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: state.refresh, push: vi.fn(), replace: vi.fn() }) }));

import { TxActions } from "@/components/bank/tx-actions";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
  for (const m of Object.values(state)) m.mockReset();
});
afterEach(cleanup);

const CATS = [
  { id: "c1", name: "Étterem" },
  { id: "c2", name: "Élelmiszer" },
];

function setup(over: Partial<React.ComponentProps<typeof TxActions>> = {}) {
  const user = userEvent.setup();
  render(
    <NextIntlClientProvider locale="hu" messages={hu}>
      <ToastProvider>
        <TxActions id="tx1" name="Tesco" categorized={false} hasMerchantKey categories={CATS} {...over} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
  return user;
}

describe("TxActions — besorolás és „Ez nem kiadás” a Tranzakciók listán", () => {
  it("besorolatlan tételnél kategória-választó + Besorolás / Ezt mindig így; kategória nélkül mindkettő tiltott", async () => {
    const user = setup();
    expect(screen.getByRole("button", { name: "Besorolás" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ezt mindig így" })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText("Kategória: Tesco"), "c1");
    expect(screen.getByRole("button", { name: "Besorolás" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Ezt mindig így" })).toBeEnabled();
  });

  it("„Besorolás” és „Ezt mindig így” a megfelelő `remember` jelzővel hívja az atomi akciót", async () => {
    state.classify.mockResolvedValue({ ok: true, data: { classified: 3 } });
    const user = setup();
    await user.selectOptions(screen.getByLabelText("Kategória: Tesco"), "c2");
    await user.click(screen.getByRole("button", { name: "Besorolás" }));
    await waitFor(() => expect(state.classify).toHaveBeenCalledWith({ transactionId: "tx1", categoryId: "c2", remember: false }));
    await user.click(screen.getByRole("button", { name: "Ezt mindig így" }));
    await waitFor(() => expect(state.classify).toHaveBeenLastCalledWith({ transactionId: "tx1", categoryId: "c2", remember: true }));
    expect((await screen.findAllByText("3 tétel besorolva.")).length).toBeGreaterThan(0); // minden sikeres művelet külön visszajelzést kap
  });

  it("kereskedő-kulcs nélkül az „Ezt mindig így” tiltott; a már besorolt tételen nincs választó, csak az „Ez nem kiadás”", async () => {
    setup({ hasMerchantKey: false });
    await userEvent.setup().selectOptions(screen.getByLabelText("Kategória: Tesco"), "c1");
    expect(screen.getByRole("button", { name: "Ezt mindig így" })).toBeDisabled();
    cleanup();
    setup({ categorized: true });
    expect(screen.queryByLabelText("Kategória: Tesco")).toBeNull();
    expect(screen.queryByRole("button", { name: "Besorolás" })).toBeNull();
    expect(screen.getByRole("button", { name: "Ez nem kiadás" })).toBeInTheDocument();
  });

  it("„Ez nem kiadás”: megerősítés után hívódik; a Mégse nem hív semmit", async () => {
    state.dismiss.mockResolvedValue({ ok: true });
    const user = setup({ categorized: true });
    await user.click(screen.getByRole("button", { name: "Ez nem kiadás" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Mégse" }));
    expect(state.dismiss).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Ez nem kiadás" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Nem kiadás" }));
    await waitFor(() => expect(state.dismiss).toHaveBeenCalledWith("tx1"));
  });

  it("hiba érthető üzenetet ad (nem található)", async () => {
    state.classify.mockResolvedValue({ ok: false, code: "not_found", reason: "not_found" });
    const user = setup();
    await user.selectOptions(screen.getByLabelText("Kategória: Tesco"), "c1");
    await user.click(screen.getByRole("button", { name: "Besorolás" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ezt nem találjuk");
  });
});
