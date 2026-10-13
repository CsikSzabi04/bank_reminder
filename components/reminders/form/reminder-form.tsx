"use client";

import { TriangleAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Notice } from "@/components/auth/notice";
import { SubmitButton } from "@/components/auth/submit-button";
import { TextField } from "@/components/auth/text-field";
import { useFocusFirstError } from "@/components/auth/use-focus-first-error";
import type { ActionState } from "@/lib/action-state";
import { formatShortDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { previewDates, saveReminder, type PreviewResult } from "@/lib/reminders/form-actions";
import type { FormValues } from "@/lib/reminders/form-values";
import { CURRENCIES, USAGE_TAGS } from "@/lib/schemas/reminder";
import { cn } from "@/lib/utils";
import { OffsetChips } from "./offset-chips";
import { RecurrencePicker } from "./recurrence-picker";
import { ServicePicker, type CatalogItem } from "./service-picker";
import { useReminderErrorText } from "./use-reminder-error";

export type CategoryOption = { id: string; key: string; name: string };

// A katalógus-kategóriák közül ezek előfizetések (a telefon/internet számla, nem előfizetés)
const SUBSCRIPTION_CATEGORY_KEYS = new Set(["streaming", "music", "software", "gaming"]);

const SECTION = "flex flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-card";
const SELECT = "min-h-12 w-full rounded-control border border-border bg-surface-2 px-4 text-text";
const CHECK = "flex min-h-11 items-center gap-2 text-sm";
const PREVIEW_DEBOUNCE_MS = 300;
const NEXT_DATES_SHOWN = 3;

export function ReminderForm({
  reminderId,
  initial,
  categories,
  catalog,
  today,
  cancelHref,
}: {
  /** szerkesztésnél az emlékeztető azonosítója; nélküle új emlékeztető */
  reminderId?: string;
  initial: FormValues;
  categories: CategoryOption[];
  catalog: CatalogItem[];
  /** a mai nap a profil időzónájában */
  today: string;
  cancelHref: string;
}) {
  const t = useTranslations("reminders.form");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const errorText = useReminderErrorText();
  const isNew = reminderId === undefined;

  const [state, action] = useActionState(saveReminder.bind(null, reminderId ?? null), null as ActionState | null);
  const [values, setValues] = useState<FormValues>(initial);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const moreRef = useRef<HTMLDetailsElement>(null);
  useFocusFirstError(state, formRef);

  const patch = (p: Partial<FormValues>) => setValues((v) => ({ ...v, ...p }));
  const fe = (state && !state.ok ? state.fieldErrors : undefined) ?? {};
  const moreErrors = Boolean(fe.endDate || fe.trialEndsOn || fe.note || fe.url);

  // a "Továbbiak" szakasz zárva hibát rejthetne → hibánál kinyitjuk
  useEffect(() => {
    if (moreErrors && moreRef.current) moreRef.current.open = true;
  }, [moreErrors, state]);

  // Az előnézetet (és a javaslatot) a szerver számolja (preview_dates): a kliens nem tartalmaz dátum-szabályokat
  useEffect(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.startDate)) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await previewDates({
        recurrence: values.recurrence,
        every: values.recurEvery >= 1 ? values.recurEvery : 1,
        unit: values.recurUnit,
        startDate: values.startDate,
        monthEnd: values.monthEnd,
      });
      if (!cancelled) setPreview(result);
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [values.recurrence, values.recurEvery, values.recurUnit, values.startDate, values.monthEnd]);

  const from = isNew ? today : values.startDate;
  const upcoming = preview?.ok ? preview.dates.filter((d) => d >= from).slice(0, NEXT_DATES_SHOWN) : [];
  const pastStart = isNew && /^\d{4}-\d{2}-\d{2}$/.test(values.startDate) && values.startDate < today;
  const suggestion = pastStart ? (preview?.ok ? (preview.dates.find((d) => d >= today) ?? today) : today) : null;

  const selectService = (item: CatalogItem) =>
    patch({
      name: item.name,
      serviceSlug: item.slug,
      categoryId: categories.find((c) => c.key === item.categoryKey)?.id ?? values.categoryId,
      isSubscription: SUBSCRIPTION_CATEGORY_KEYS.has(item.categoryKey),
    });

  const typeName = (text: string) => {
    // a katalógus-kapcsolat csak addig érvényes, amíg a név a választottal egyezik
    const chosen = catalog.find((c) => c.slug === values.serviceSlug);
    patch({ name: text, serviceSlug: chosen && chosen.name === text ? values.serviceSlug : "" });
  };

  const toggleTag = (tag: string) =>
    patch({ usageTags: values.usageTags.includes(tag) ? values.usageTags.filter((x) => x !== tag) : [...values.usageTags, tag] });

  const generalFailure = state && !state.ok && state.code !== "validation";

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-5">
      <input type="hidden" name="serviceSlug" value={values.serviceSlug} />

      {generalFailure && <Notice variant="error">{t("saveFailed")}</Notice>}
      <FormAlert state={state && !state.ok && state.code === "validation" && !state.reason ? null : state} />

      <section className={SECTION}>
        <ServicePicker
          value={values.name}
          catalog={catalog}
          errors={fe.name}
          translateError={errorText}
          onType={typeName}
          onSelect={selectService}
        />
        <div className="flex gap-3">
          <div className="flex-1">
            <TextField
              name="amount"
              label={t("amount")}
              inputMode="decimal"
              autoComplete="off"
              value={values.amount}
              onChange={(e) => patch({ amount: e.target.value })}
              errors={fe.amount}
              translateError={errorText}
              required
            />
          </div>
          <label className="flex w-28 flex-col gap-1.5 text-sm font-medium text-text-2">
            {t("currency")}
            <select name="currency" value={values.currency} onChange={(e) => patch({ currency: e.target.value })} className={SELECT}>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-text-2">
          {t("category")}
          <select name="categoryId" value={values.categoryId} onChange={(e) => patch({ categoryId: e.target.value })} className={SELECT}>
            <option value="">{t("categoryNone")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className={SECTION}>
        <RecurrencePicker
          values={values}
          onChange={patch}
          errors={{ startDate: fe.startDate, recurEvery: fe.recurEvery, recurUnit: fe.recurUnit }}
          translateError={errorText}
        />
        <div aria-live="polite" className="flex flex-col gap-2 text-sm">
          {pastStart && suggestion && (
            <div className="flex flex-wrap items-center gap-2 rounded-control border border-warning/50 bg-surface-2 px-3 py-2 text-warning-text">
              <TriangleAlert className="size-4 shrink-0" aria-hidden />
              <span>{t("preview.past")}</span>
              <span className="font-medium">{t("preview.suggestion", { date: formatShortDate(suggestion, locale) })}</span>
              <button
                type="button"
                onClick={() => patch({ startDate: suggestion })}
                className="min-h-11 rounded-control border border-border bg-surface px-3 font-medium text-text hover:bg-surface-2"
              >
                {t("preview.apply")}
              </button>
            </div>
          )}
          <p className="text-text-2">
            {preview === null
              ? t("preview.loading")
              : upcoming.length > 0
                ? t("preview.next", { dates: upcoming.map((d) => formatShortDate(d, locale)).join(", ") })
                : t("preview.none")}
          </p>
        </div>
      </section>

      <section className={SECTION}>
        <label className={cn(CHECK, "font-medium")}>
          <input
            type="checkbox"
            name="remindEnabled"
            checked={values.remindEnabled}
            onChange={(e) => patch({ remindEnabled: e.target.checked })}
            className="size-5 accent-primary"
          />
          {t("notify")}
        </label>
        {/* kikapcsolva elrejtjük, de a mezők megmaradnak (a beállítások nem vesznek el) */}
        <div hidden={!values.remindEnabled} className="flex flex-col gap-4">
          <OffsetChips offsets={values.offsets} onChange={(offsets) => patch({ offsets })} error={fe.offsets ? errorText(fe.offsets[0]) : undefined} />
          <TextField
            name="remindTime"
            type="time"
            label={t("time")}
            value={values.remindTime}
            onChange={(e) => patch({ remindTime: e.target.value })}
            errors={fe.remindTime}
            translateError={errorText}
          />
          <fieldset className="flex flex-col gap-1">
            <legend className="text-sm font-medium text-text-2">{t("channels")}</legend>
            <label className={CHECK}>
              <input type="checkbox" name="channelPush" checked={values.channelPush} onChange={(e) => patch({ channelPush: e.target.checked })} className="size-5 accent-primary" />
              {t("channelPush")}
            </label>
            <label className={CHECK}>
              <input type="checkbox" name="channelEmail" checked={values.channelEmail} onChange={(e) => patch({ channelEmail: e.target.checked })} className="size-5 accent-primary" />
              {t("channelEmail")}
            </label>
          </fieldset>
        </div>
      </section>

      <details ref={moreRef} className={SECTION}>
        <summary className="min-h-11 cursor-pointer text-base font-semibold">{t("more")}</summary>
        <div className="mt-4 flex flex-col gap-4">
          <label className={CHECK}>
            <input type="checkbox" name="isSubscription" checked={values.isSubscription} onChange={(e) => patch({ isSubscription: e.target.checked })} className="size-5 accent-primary" />
            {t("subscription")}
          </label>
          {values.isSubscription && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium text-text-2">{t("usage")}</legend>
              <div className="flex flex-wrap gap-2">
                {USAGE_TAGS.map((tag) => {
                  const on = values.usageTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleTag(tag)}
                      className={cn(
                        "min-h-11 rounded-full border px-4 text-sm font-medium",
                        on ? "border-primary bg-primary-soft text-primary-text" : "border-border bg-surface text-text-2 hover:bg-surface-2",
                      )}
                    >
                      {t(`usageTag.${tag}`)}
                    </button>
                  );
                })}
              </div>
              {values.usageTags.map((tag) => (
                <input key={tag} type="hidden" name="usageTag" value={tag} />
              ))}
            </fieldset>
          )}
          <TextField
            name="trialEndsOn"
            type="date"
            label={t("trialEnds")}
            value={values.trialEndsOn}
            onChange={(e) => patch({ trialEndsOn: e.target.value })}
            errors={fe.trialEndsOn}
            translateError={errorText}
          />
          <label className={CHECK}>
            <input type="checkbox" name="autoPaid" checked={values.autoPaid} onChange={(e) => patch({ autoPaid: e.target.checked })} className="size-5 accent-primary" />
            {t("autoPaid")}
          </label>
          <TextField
            name="endDate"
            type="date"
            label={t("endDate")}
            value={values.endDate}
            onChange={(e) => patch({ endDate: e.target.value })}
            errors={fe.endDate}
            translateError={errorText}
          />
          <TextField
            name="url"
            type="url"
            inputMode="url"
            label={t("url")}
            value={values.url}
            onChange={(e) => patch({ url: e.target.value })}
            errors={fe.url}
            translateError={errorText}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="reminder-note" className="text-sm font-medium text-text-2">
              {t("note")}
            </label>
            <textarea
              id="reminder-note"
              name="note"
              rows={3}
              maxLength={500}
              value={values.note}
              onChange={(e) => patch({ note: e.target.value })}
              aria-invalid={fe.note ? true : undefined}
              aria-describedby="reminder-note-hint"
              className="rounded-control border border-border bg-surface-2 px-4 py-3 text-text aria-invalid:border-danger"
            />
            <p id="reminder-note-hint" className="flex items-center gap-1.5 text-sm text-warning-text">
              <TriangleAlert className="size-4 shrink-0" aria-hidden />
              {t("noteWarning")}
            </p>
            {fe.note && <p className="text-sm text-danger-text">{errorText(fe.note[0])}</p>}
          </div>
        </div>
      </details>

      {/* ragadós mentés-sáv: mobilon a fül-sáv fölött */}
      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 flex gap-3 rounded-card border border-border bg-surface/95 p-3 shadow-card backdrop-blur md:bottom-4">
        <Link href={cancelHref} className="flex min-h-12 items-center rounded-control border border-border bg-surface px-5 font-medium hover:bg-surface-2">
          {tc("cancel")}
        </Link>
        <div className="flex-1">
          <SubmitButton pendingLabel={t("saving")}>{t("save")}</SubmitButton>
        </div>
      </div>
    </form>
  );
}
