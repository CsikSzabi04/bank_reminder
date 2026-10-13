import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PayButton } from "@/components/reminders/pay-button";
import { ToastProvider } from "@/components/ui/toast";
import type { ActionState } from "@/lib/action-state";
import hu from "@/locales/hu.json";

afterEach(cleanup);

const OK: ActionState = { ok: true };
const FAIL: ActionState = { ok: false, code: "upstream_failed" };

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function setup(onPay: () => Promise<ActionState>, onUndo: () => Promise<ActionState> = async () => OK) {
  const user = userEvent.setup();
  render(
    <NextIntlClientProvider locale="hu" messages={hu}>
      <ToastProvider>
        <PayButton status="upcoming" name="Netflix" onPay={onPay} onUndo={onUndo} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
  return { user, button: () => screen.queryByRole("button", { name: "Netflix kifizetettnek jelölése" }) };
}

describe("PayButton (optimista)", () => {
  it("kattintásra azonnal „Kifizetve” látszik, a szerver válaszáig is", async () => {
    const d = deferred<ActionState>();
    const onPay = vi.fn(() => d.promise);
    const { user, button } = setup(onPay);

    await user.click(button()!);

    expect(onPay).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Kifizetve")).toBeInTheDocument(); // optimista állapot
    expect(button()).toBeNull();
    await act(async () => d.resolve(OK));
  });

  it("siker után Visszavonás-toast; a Visszavonás az onUndo-t hívja", async () => {
    const onUndo = vi.fn(async () => OK);
    const { user, button } = setup(async () => OK, onUndo);

    await user.click(button()!);
    expect(await screen.findByText("Netflix: kifizetve")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Visszavonás" }));
    await waitFor(() => expect(onUndo).toHaveBeenCalledTimes(1));
  });

  it("hiba esetén hibaüzenet-toast, és a gomb visszatér (nincs Visszavonás-ajánlat)", async () => {
    const { user, button } = setup(async () => FAIL);

    await user.click(button()!);

    expect(await screen.findByText("Nem sikerült menteni. Próbáld újra.")).toBeInTheDocument();
    await waitFor(() => expect(button()).not.toBeNull());
    expect(screen.queryByRole("button", { name: "Visszavonás" })).toBeNull();
  });

  it("a gomb a futás alatt nem nyomható újra (dupla kattintás védelem)", async () => {
    const d = deferred<ActionState>();
    const onPay = vi.fn(() => d.promise);
    const { user, button } = setup(onPay);

    await user.click(button()!);
    // optimista állapotban a gomb már nincs a DOM-ban → nem lehet másodszor is elküldeni
    expect(button()).toBeNull();
    expect(onPay).toHaveBeenCalledTimes(1);
    await act(async () => d.resolve(OK));
  });
});
