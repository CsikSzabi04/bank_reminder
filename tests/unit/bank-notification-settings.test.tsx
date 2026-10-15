import { cleanup, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { consentBannerInfo, parseConnections } from "@/lib/bank/connections";
import en from "@/locales/en.json";
import hu from "@/locales/hu.json";

// a szerver-akciót kicseréljük: az űrlap megjelenését és szerkezetét teszteljük, nem a mentést (azt a push-actions teszt fedi)
vi.mock("@/lib/push/actions", () => ({ updateNotificationSettings: vi.fn() }));
import { NotificationSettingsForm, type NotificationSettings } from "@/components/push/notification-settings-form";

afterEach(cleanup);

const INITIAL: NotificationSettings = {
  remindersEnabled: true,
  offsets: [1, 3],
  notifyTime: "09:00",
  channelPush: true,
  channelEmail: false,
  hideDetails: false,
  weeklyDigest: false,
  budgetAlerts: true,
};

function renderForm(props: { showBankConsent?: boolean; initial?: Partial<NotificationSettings>; locale?: "hu" | "en" } = {}) {
  const messages = props.locale === "en" ? en : hu;
  return render(
    <NextIntlClientProvider locale={props.locale ?? "hu"} messages={messages}>
      <NotificationSettingsForm initial={{ ...INITIAL, ...props.initial }} showBankConsent={props.showBankConsent} />
    </NextIntlClientProvider>,
  );
}

describe("Profil → Értesítések: keret-riasztás és kötelező bank-lejárat (B-46)", () => {
  it("a „Keret-riasztások” kapcsoló a mentett értéket mutatja, és budgetAlerts néven megy a szerverre", () => {
    const { rerender } = renderForm({ initial: { budgetAlerts: true } });
    const box = screen.getByRole("checkbox", { name: /Keret-riasztások/ });
    expect(box).toBeChecked();
    expect(box).toHaveAttribute("name", "budgetAlerts");
    cleanup();
    renderForm({ initial: { budgetAlerts: false } });
    expect(screen.getByRole("checkbox", { name: /Keret-riasztások/ })).not.toBeChecked();
    void rerender;
  });

  it("a keret-riasztás független az emlékeztetők főkapcsolójától (kikapcsolt főkapcsoló mellett is állítható)", () => {
    renderForm({ initial: { remindersEnabled: false, budgetAlerts: true } });
    expect(screen.getByRole("checkbox", { name: /Keret-riasztások/ })).toBeEnabled();
  });

  it("a kötelező bank-lejárat sor NEM kapcsoló: nincs hozzá jelölőnégyzet, de a „kötelező” szöveg ott van", () => {
    renderForm({ showBankConsent: true });
    expect(screen.getByText("Bank-hozzáférés lejárata — kötelező")).toBeInTheDocument();
    const row = screen.getByText("Bank-hozzáférés lejárata — kötelező").closest("div")!;
    expect(within(row).queryAllByRole("checkbox")).toHaveLength(0);
    expect(row.querySelector("input")).toBeNull();
    // és sehol nincs olyan jelölőnégyzet, amelynek a neve a bank-lejáratra utal
    expect(screen.queryByRole("checkbox", { name: /Bank-hozzáférés/ })).toBeNull();
  });

  it("a főkapcsoló szövege kiegészül: a bank-lejárat ettől függetlenül jön (be- és kikapcsolt állapotban is)", () => {
    renderForm({ showBankConsent: true, initial: { remindersEnabled: true } });
    expect(screen.getByText(/A bank-hozzáférés lejárat-értesítései ettől függetlenül jönnek\./)).toBeInTheDocument();
    cleanup();
    renderForm({ showBankConsent: true, initial: { remindersEnabled: false } });
    expect(screen.getByText(/A bank-hozzáférés lejárat-értesítései ettől függetlenül jönnek\./)).toBeInTheDocument();
  });

  it("bank-összekötés nélkül (nem jogosult) a kötelező sor és a kiegészítés nem látszik (nem zaj)", () => {
    renderForm({ showBankConsent: false });
    expect(screen.queryByText("Bank-hozzáférés lejárata — kötelező")).toBeNull();
    expect(screen.queryByText(/lejárat-értesítései ettől függetlenül/)).toBeNull();
  });

  it("angolul is: a kötelező sor és a keret-riasztás", () => {
    renderForm({ showBankConsent: true, locale: "en" });
    expect(screen.getByText("Bank access expiry — required")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Budget alerts/ })).toBeInTheDocument();
  });
});

describe("consentBannerInfo (Főoldal-sáv, ≤ 30 nap)", () => {
  const row = (over: Record<string, unknown>) => ({
    id: "c1",
    aspsp_name: "Revolut",
    aspsp_country: "HU",
    status: "active",
    authorized_at: "2026-04-18T08:00:00Z",
    consent_valid_until: "2026-10-15T08:00:00Z",
    last_sync_at: null,
    last_sync_ok: null,
    accounts: [],
    ...over,
  });
  const tz = "Europe/Budapest";
  const at = (iso: string) => new Date(iso);

  it("30 napnál több hátralévő időnél nincs sáv; 30-nál és kevesebbnél van", () => {
    const c = parseConnections([row({})]);
    expect(consentBannerInfo(c, tz, at("2026-09-14T10:00:00Z"))).toBeNull();
    expect(consentBannerInfo(c, tz, at("2026-09-15T10:00:00Z"))).toEqual({ bank: "Revolut", daysLeft: 30, expired: false });
    expect(consentBannerInfo(c, tz, at("2026-10-15T10:00:00Z"))).toEqual({ bank: "Revolut", daysLeft: 0, expired: false });
  });

  it("lejárt kapcsolatról is szól; a visszavont és a hibás (de nem lejáró) kapcsolat nem ad sávot", () => {
    expect(consentBannerInfo(parseConnections([row({})]), tz, at("2026-10-20T10:00:00Z"))).toMatchObject({ expired: true, daysLeft: -5 });
    expect(consentBannerInfo(parseConnections([row({ status: "revoked" })]), tz, at("2026-10-14T10:00:00Z"))).toBeNull();
    expect(consentBannerInfo(parseConnections([row({ status: "error", consent_valid_until: "2027-03-01T00:00:00Z" })]), tz, at("2026-10-14T10:00:00Z"))).toBeNull();
    expect(consentBannerInfo([], tz)).toBeNull();
  });

  it("több kapcsolat közül a legsürgősebbet mutatja", () => {
    const c = parseConnections([row({ id: "a", aspsp_name: "A Bank", consent_valid_until: "2026-10-25T08:00:00Z" }), row({ id: "b", aspsp_name: "B Bank", consent_valid_until: "2026-10-18T08:00:00Z" })]);
    expect(consentBannerInfo(c, tz, at("2026-10-14T10:00:00Z"))?.bank).toBe("B Bank");
  });
});
