import { getLocale, getTranslations } from "next-intl/server";
import { BankFlashBanner } from "@/components/bank/bank-flash";
import { ConnectPanel } from "@/components/bank/connect-panel";
import { ConnectionCard } from "@/components/bank/connection-card";
import { ConsentTimeline } from "@/components/bank/consent-timeline";
import { CategoryChip } from "@/components/categories/category-chip";
import { CategoryIcon } from "@/components/categories/category-icon";
import { AmountText } from "@/components/ui/amount-text";
import { LanguageSwitch } from "@/components/shell/language-switch";
import { ThemeSwitch } from "@/components/shell/theme-switch";
import { parseConnections } from "@/lib/bank/connections";
import { formatMoney } from "@/lib/format";
import { FIXTURE_CATEGORIES } from "@/lib/fixtures/reminders";
import type { Locale } from "@/lib/i18n/config";
import { Demos } from "./demos";

// Fejlesztői játszótér (csak dev). A komponensek állapotai a B-10-től ide kerülnek.
const SWATCHES = [
  ["bg", "bg-bg"],
  ["surface", "bg-surface"],
  ["surface-2", "bg-surface-2"],
  ["primary", "bg-primary"],
  ["primary-soft", "bg-primary-soft"],
  ["success", "bg-success"],
  ["warning", "bg-warning"],
  ["danger", "bg-danger"],
] as const;

const TEXTS = [
  ["text", "text-text"],
  ["text-2", "text-text-2"],
  ["text-muted", "text-text-muted"],
  ["success-text", "text-success-text"],
  ["warning-text", "text-warning-text"],
  ["danger-text", "text-danger-text"],
] as const;

const inDays = (from: Date, days: number) => new Date(from.getTime() + days * 86_400_000).toISOString();

// Szintetikus bank-kapcsolatok a bemutatóhoz (nem valódi adat): 3 számla-típus (folyószámla IBAN-nal, azonos IBAN-ú más pénznem, IBAN nélküli megtakarítás)
const demoConnections = (now: Date) =>
  parseConnections([
    {
      id: "00000000-0000-4000-8000-000000000001",
      aspsp_name: "Demo Bank",
      aspsp_country: "HU",
      status: "active",
      authorized_at: inDays(now, -160),
      consent_valid_until: inDays(now, 20),
      last_sync_at: inDays(now, -0.1),
      last_sync_ok: true,
      accounts: [
        { identification_hash: "d1", cash_account_type: "CACC", currency: "HUF", iban_last4: "0000", name: "Fő számla", sync_enabled: true },
        { identification_hash: "d2", cash_account_type: "CACC", currency: "USD", iban_last4: "0000", sync_enabled: false },
        { identification_hash: "d3", cash_account_type: "SVGS", currency: "HUF", name: "Megtakarítás", sync_enabled: false },
      ],
    },
    {
      id: "00000000-0000-4000-8000-000000000002",
      aspsp_name: "Demo Bank 2",
      aspsp_country: "HU",
      status: "expired",
      authorized_at: inDays(now, -190),
      consent_valid_until: inDays(now, -10),
      last_sync_at: inDays(now, -11),
      last_sync_ok: false,
      accounts: [{ identification_hash: "e1", cash_account_type: "CACC", currency: "EUR" }],
    },
  ]);

export default async function DevUiPage() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();
  const section = "mb-3 text-lg font-semibold";
  const now = new Date();

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">/dev/ui</h1>

      <section>
        <h2 className={section}>{t("common.theme.label")} · {t("common.language.label")}</h2>
        <div className="flex flex-wrap gap-3">
          <ThemeSwitch />
          <LanguageSwitch />
        </div>
      </section>

      <section>
        <h2 className={section}>Tokens</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SWATCHES.map(([name, cls]) => (
            <div key={name} className="rounded-card border border-border bg-surface p-3 shadow-card">
              <div className={`${cls} h-10 rounded-control border border-border`} />
              <p className="mt-2 text-sm text-text-2">{name}</p>
            </div>
          ))}
        </div>
        <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TEXTS.map(([name, cls]) => (
            <li key={name} className={`${cls} rounded-control bg-surface-2 px-3 py-2 text-sm`}>
              {name}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className={section}>Typography</h2>
        <p className="text-[40px] leading-[1.1] font-semibold">{formatMoney(128400, "HUF", locale)}</p>
        <p className="mt-2">Árvíztűrő tükörfúrógép — ŐŰ őű ÁÉÍÓÖÚÜ</p>
        <ul className="mt-3 max-w-xs text-sm tabular-nums">
          {[2300, 14200, 128400].map((n) => (
            <li key={n} className="flex justify-between border-b border-border py-1">
              <span className="text-text-2">{n}</span>
              <span>{formatMoney(n, "HUF", locale)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className={section}>CategoryChip · CategoryIcon · AmountText</h2>
        <div className="flex flex-wrap gap-2">
          {Object.values(FIXTURE_CATEGORIES).map((c) => (
            <CategoryChip key={c.id} category={c} />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          {Object.values(FIXTURE_CATEGORIES).map((c) => (
            <CategoryIcon key={c.id} icon={c.icon} colorSlot={c.colorSlot} />
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-baseline gap-6">
          <AmountText amount={128400} currency="HUF" hero />
          <AmountText amount={2300} currency="HUF" />
          <AmountText amount={12.5} currency="EUR" />
          <AmountText amount={9.99} currency="USD" />
        </div>
      </section>

      <section>
        <h2 className={section}>ConsentTimeline</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {/* szintetikus dátumok a mai naphoz képest: 180 napos hozzáférés 20 nap múlva lejár · 14 napos rövid hozzáférés */}
          <ConsentTimeline validUntil={inDays(now, 20)} authorizedAt={inDays(now, -160)} timeZone="Europe/Budapest" now={now} />
          <ConsentTimeline validUntil={inDays(now, 13)} authorizedAt={inDays(now, -1)} timeZone="Europe/Budapest" now={now} />
        </div>
      </section>

      <section>
        <h2 className={section}>Bank: ConnectionCard · ConnectPanel · BankFlashBanner</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {demoConnections(now).map((c) => (
            <ConnectionCard key={c.id} connection={c} timeZone="Europe/Budapest" now={now} />
          ))}
          <ConnectPanel
            another
            listError={null}
            banks={[
              { name: "Demo Bank", country: "HU", maxConsentDays: 180 },
              { name: "Demo Bank 2", country: "HU", maxConsentDays: 90 },
            ]}
          />
          <ConnectPanel another={false} listError="upstream_failed" banks={[]} />
          <div className="flex flex-col gap-3">
            <BankFlashBanner flash={{ kind: "connected" }} />
            <BankFlashBanner flash={{ kind: "error", reason: "state_invalid" }} />
          </div>
        </div>
      </section>

      <Demos />

      <section>
        <h2 className={section}>Buttons · focus</h2>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="min-h-11 rounded-control bg-primary px-5 font-medium text-primary-fg">
            {t("common.save")}
          </button>
          <button type="button" className="min-h-11 rounded-control border border-border bg-surface px-5 font-medium">
            {t("common.cancel")}
          </button>
          <button type="button" className="min-h-11 rounded-control bg-danger px-5 font-medium text-white">
            {t("common.delete")}
          </button>
        </div>
      </section>
    </div>
  );
}
