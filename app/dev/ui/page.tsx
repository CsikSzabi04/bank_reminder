import { getLocale, getTranslations } from "next-intl/server";
import { CategoryChip } from "@/components/categories/category-chip";
import { CategoryIcon } from "@/components/categories/category-icon";
import { AmountText } from "@/components/ui/amount-text";
import { LanguageSwitch } from "@/components/shell/language-switch";
import { ThemeSwitch } from "@/components/shell/theme-switch";
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

export default async function DevUiPage() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations();
  const section = "mb-3 text-lg font-semibold";

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
