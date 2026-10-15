import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast";
import type { IngestToken } from "@/lib/bank/ingest";
import hu from "@/locales/hu.json";

// A szerver-akciókat és a routert kicseréljük: a felület viselkedését teszteljük (egyszeri megjelenítés, szerkesztő, megerősítések)
const state = vi.hoisted(() => ({
  create: vi.fn(),
  revoke: vi.fn(),
  regenerate: vi.fn(),
  saveApps: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/lib/bank/ingest-actions", () => ({
  createIngestToken: state.create,
  revokeIngestToken: state.revoke,
  regenerateIngestToken: state.regenerate,
  saveIngestApps: state.saveApps,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: state.refresh, push: vi.fn(), replace: vi.fn() }) }));

import { CopyField } from "@/components/bank/copy-field";
import { IngestPanel } from "@/components/bank/ingest-panel";
import { PlatformHint } from "@/components/bank/platform-hint";

// a jsdom nem ismeri a <dialog> modális API-ját: a ConfirmDialog (BottomSheet) teszteléséhez egyszerű helyettesítő
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
  for (const m of [state.create, state.revoke, state.regenerate, state.saveApps, state.refresh]) m.mockReset();
});
afterEach(cleanup);

const RAW = `tk_${"x".repeat(40)}`;
const token = (over: Partial<IngestToken> = {}): IngestToken => ({
  id: "11111111-2222-4333-8444-555555555555",
  prefix: "tk_abc",
  label: "Telefon",
  allowedApps: ["hu.a.b"],
  lastUsedAt: null,
  revokedAt: null,
  createdAt: "2026-10-01T10:00:00Z",
  ...over,
});

function setup(tokens: IngestToken[] = [token()], suggestions: string[] = []) {
  const user = userEvent.setup();
  const view = (
    <NextIntlClientProvider locale="hu" messages={hu}>
      <ToastProvider>
        <IngestPanel tokens={tokens} suggestions={suggestions} timeZone="Europe/Budapest" />
      </ToastProvider>
    </NextIntlClientProvider>
  );
  return { user, ...render(view), view };
}

describe("token létrehozása — a nyers token egyszer látszik", () => {
  it("létrehozás után megjelenik, a „Elrejtés” után eltűnik a DOM-ból; az akció üres app-listával és a címkével hívódik", async () => {
    state.create.mockResolvedValue({ ok: true, data: { id: "new", token: RAW, prefix: "tk_new" } });
    const { user } = setup([]);
    await user.type(screen.getByLabelText(/Címke/), "Új telefon");
    await user.click(screen.getByRole("button", { name: "Új token létrehozása" }));

    expect(await screen.findByText("A tokened — most látod utoljára")).toBeInTheDocument();
    expect(screen.getByDisplayValue(RAW)).toBeInTheDocument();
    expect(state.create).toHaveBeenCalledWith({ label: "Új telefon", apps: [] });
    expect(screen.getByText(/Következő lépés: add meg lent az engedélyezett appokat/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Elrejtés" }));
    expect(screen.queryByDisplayValue(RAW)).toBeNull();
    expect(document.body.textContent).not.toContain(RAW);
  });

  it("újratöltés (újra-renderelés a szerver-adatból) után a nyers token már nincs meg — csak az előtag", async () => {
    state.create.mockResolvedValue({ ok: true, data: { id: "new", token: RAW, prefix: "tk_new" } });
    const first = setup([]);
    await first.user.click(screen.getByRole("button", { name: "Új token létrehozása" }));
    await screen.findByDisplayValue(RAW);
    first.unmount();

    // a szerver-oldali lista csak az előtagot adja, a nyers tokent soha
    setup([token({ id: "new", prefix: "tk_new", label: null })]);
    expect(document.body.textContent).not.toContain(RAW);
    expect(screen.getByText("tk_new…")).toBeInTheDocument();
  });

  it("hibánál érthető üzenet (a szerver-oldal még nincs telepítve → „még nem érhető el”), token nem jelenik meg", async () => {
    state.create.mockResolvedValue({ ok: false, code: "upstream_failed", reason: "unavailable" });
    const { user } = setup([]);
    await user.click(screen.getByRole("button", { name: "Új token létrehozása" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ez a funkció még nem érhető el");
    expect(screen.queryByText("A tokened — most látod utoljára")).toBeNull();
  });
});

describe("tokenlista", () => {
  it("az aktív tokenhez tartozik app-szerkesztő és művelet; a visszavont tokenen nincs szerkesztő és gomb", () => {
    setup([token(), token({ id: "revoked-1", prefix: "tk_old", label: "Régi", revokedAt: "2026-10-02T10:00:00Z" })]);
    const rows = screen.getAllByRole("listitem").filter((li) => li.textContent?.includes("…"));
    const active = rows.find((r) => r.textContent?.includes("tk_abc"))!;
    const revoked = rows.find((r) => r.textContent?.includes("tk_old"))!;
    expect(within(active).getByText("Aktív")).toBeInTheDocument();
    expect(within(active).getByRole("button", { name: "Visszavonás" })).toBeInTheDocument();
    expect(within(active).getByRole("button", { name: "Újragenerálás" })).toBeInTheDocument();
    expect(within(revoked).getByText("Visszavonva")).toBeInTheDocument();
    expect(within(revoked).queryByRole("button", { name: "Visszavonás" })).toBeNull();
    expect(within(revoked).queryByText("Engedélyezett appok")).toBeNull();
  });

  it("visszavonás: megerősítés után az akció a token azonosítójával hívódik; a Mégse nem hív semmit", async () => {
    state.revoke.mockResolvedValue({ ok: true });
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Visszavonás" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Mégse" }));
    expect(state.revoke).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Visszavonás" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Visszavonás" }));
    await waitFor(() => expect(state.revoke).toHaveBeenCalledWith("11111111-2222-4333-8444-555555555555"));
  });

  it("újragenerálás: az új token egyszer megjelenik; ha a régit nem sikerült visszavonni, figyelmeztet", async () => {
    state.regenerate.mockResolvedValue({ ok: true, data: { id: "n2", token: RAW, prefix: "tk_n2", oldRevoked: false } });
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Újragenerálás" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Újragenerálás" }));
    expect(await screen.findByDisplayValue(RAW)).toBeInTheDocument();
    expect(screen.getByText(/a régit nem sikerült visszavonni/)).toBeInTheDocument();
  });
});

describe("engedélyezett appok szerkesztője", () => {
  it("érvénytelen csomagnév hibát ad és nem kerül a listába; érvényes hozzáadódik, a duplikátum nem", async () => {
    const { user } = setup([token({ allowedApps: [] })]);
    const input = screen.getByLabelText("Csomagnév");
    await user.type(input, "nem csomag");
    await user.click(screen.getByRole("button", { name: "Hozzáadás" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Érvénytelen csomagnév");
    expect(screen.getByText("Nincs engedélyezett app.")).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "hu.otp.mobile");
    await user.click(screen.getByRole("button", { name: "Hozzáadás" }));
    await user.type(input, "hu.otp.mobile");
    await user.click(screen.getByRole("button", { name: "Hozzáadás" }));
    expect(screen.getAllByText("hu.otp.mobile")).toHaveLength(1);
  });

  it("a „legutóbb érkezett” app koppintással hozzáadható, és a mentés a tisztított listát küldi — változtatás nélkül a Mentés tiltott", async () => {
    state.saveApps.mockResolvedValue({ ok: true, data: { apps: ["hu.a.b", "hu.new.app"] } });
    const { user } = setup([token()], ["hu.new.app"]);
    const save = screen.getByRole("button", { name: "Mentés" });
    expect(save).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "hu.new.app hozzáadása" }));
    expect(screen.queryByRole("button", { name: "hu.new.app hozzáadása" })).toBeNull(); // már nem javaslat
    expect(save).toBeEnabled();
    await user.click(save);
    await waitFor(() => expect(state.saveApps).toHaveBeenCalledWith({ id: "11111111-2222-4333-8444-555555555555", apps: ["hu.a.b", "hu.new.app"] }));
  });

  it("eltávolítás után a lista üres lehet (üres = semmi nem engedett), és a mentés ezt küldi", async () => {
    state.saveApps.mockResolvedValue({ ok: true, data: { apps: [] } });
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "hu.a.b eltávolítása" }));
    expect(screen.getByText("Nincs engedélyezett app.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Mentés" }));
    await waitFor(() => expect(state.saveApps).toHaveBeenCalledWith({ id: "11111111-2222-4333-8444-555555555555", apps: [] }));
  });

  it("mentési hiba érthető üzenetet ad", async () => {
    state.saveApps.mockResolvedValue({ ok: false, code: "validation", reason: "too_many_apps" });
    const { user } = setup([token({ allowedApps: [] })], ["hu.new.app"]);
    await user.click(screen.getByRole("button", { name: "hu.new.app hozzáadása" }));
    await user.click(screen.getByRole("button", { name: "Mentés" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Legfeljebb 20 app");
  });
});

describe("CopyField és PlatformHint", () => {
  const withIntl = (ui: React.ReactElement) => (
    <NextIntlClientProvider locale="hu" messages={hu}>
      {ui}
    </NextIntlClientProvider>
  );

  it("másolás: a vágólapra az érték kerül, és „Másolva.” hangzik el; vágólap nélkül kézi kijelölést kér", async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    render(withIntl(<CopyField label="Webhook-cím" value="https://abc.supabase.co/x" />));
    await user.click(screen.getByRole("button", { name: "Másolás" }));
    expect(spy).toHaveBeenCalledWith("https://abc.supabase.co/x");
    expect(await screen.findByText("Másolva.")).toBeInTheDocument();

    spy.mockRejectedValue(new Error("denied"));
    await user.click(screen.getByRole("button", { name: "Másolás" }));
    expect(await screen.findByText("Nem sikerült másolni — jelöld ki kézzel.")).toBeInTheDocument();
  });

  it("iPhone-jelzés csak Apple-eszközön (iOS nem engedi az értesítés-olvasást)", () => {
    const ua = vi.spyOn(navigator, "userAgent", "get");
    ua.mockReturnValue("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15");
    render(withIntl(<PlatformHint />));
    expect(screen.getByRole("note")).toHaveTextContent("iPhone-on az iOS nem engedi");
    cleanup();
    ua.mockReturnValue("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36");
    render(withIntl(<PlatformHint />));
    expect(screen.queryByRole("note")).toBeNull();
    ua.mockRestore();
  });
});
