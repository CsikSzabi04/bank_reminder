"use client";

import {
  AlertCircle, CalendarCheck, Clock, Copy, Gauge, HelpCircle, Hourglass, Layers, Lightbulb, PieChart, PowerOff, Scissors, TrendingUp, type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { answerUsage, setUsageTags, tipAction } from "@/lib/tips/actions";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  sub_overlap_group: Layers,
  sub_covered_by_others: Scissors,
  sub_maybe_redundant: HelpCircle,
  sub_annual_cheaper: CalendarCheck,
  price_increase: TrendingUp,
  trial_ending: Hourglass,
  subs_share_high: PieChart,
  unused_check: HelpCircle,
  sub_unused: PowerOff,
  budget_over_now: AlertCircle,
  budget_forecast_over: Gauge,
  duplicate_reminder: Copy,
  late_payment_pattern: Clock,
};

const TONE = {
  save: { box: "border-l-success", icon: "bg-success/15 text-success-text" },
  warn: { box: "border-l-warning", icon: "bg-warning/20 text-warning-text" },
  info: { box: "border-l-primary", icon: "bg-primary-soft text-primary-text" },
} as const;

const BTN = "min-h-11 rounded-control border border-border bg-surface px-3.5 text-sm font-medium hover:bg-surface-2 disabled:opacity-60";

export type TipCardProps = {
  id: string;
  code: string;
  severity: "save" | "warn" | "info";
  status: string;
  reminderId?: string;
  title: string;
  body: string;
  why: string;
  /** „kb. 1 990 Ft/hó" (a hívó formázza) */
  estimate?: string;
  /** a „Mit nézel itt?" chipjei (sub_maybe_redundant) */
  usage?: { selected: string[]; options: Array<{ tag: string; label: string }> };
};

// Tipp-kártya (§17.6): ikon · cím · 1–2 mondat · becslés · Részletek („Miért látom ezt?") · Később · Nem érdekel · Megcsináltam.
// A „Mit nézel itt?" és a „Használtad?" kérdés a saját válasz-vezérlőivel; minden státuszváltást a DB végez (tip_action).
export function TipCard(p: TipCardProps) {
  const t = useTranslations("tips");
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [tags, setTags] = useState(p.usage?.selected ?? []);
  const Icon = ICONS[p.code] ?? Lightbulb;
  const tone = TONE[p.severity];

  const run = (work: () => Promise<{ ok: boolean }>, okMessage: string) =>
    startTransition(async () => {
      const res = await work();
      toast.show({ message: res.ok ? okMessage : t("failed"), tone: res.ok ? "success" : "error" });
      if (res.ok) router.refresh();
    });

  const toggleTag = (tag: string) => setTags((cur) => (cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag]));

  return (
    <article className={cn("flex flex-col gap-3 rounded-card border border-l-4 border-border bg-surface p-4 shadow-card", tone.box)}>
      <div className="flex items-start gap-3">
        <span aria-hidden className={cn("flex size-10 shrink-0 items-center justify-center rounded-control", tone.icon)}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold">{p.title}</h3>
          <p className="mt-0.5 text-text-2">{p.body}</p>
          {p.estimate && <p className="mt-1 text-sm font-medium text-success-text">{p.estimate}</p>}
        </div>
      </div>

      {p.usage && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-text-2">{t("usageQuestion")}</legend>
          <div className="flex flex-wrap gap-2">
            {p.usage.options.map((o) => (
              <button
                key={o.tag}
                type="button"
                aria-pressed={tags.includes(o.tag)}
                onClick={() => toggleTag(o.tag)}
                className="min-h-11 rounded-full border border-border bg-surface px-3.5 text-sm font-medium text-text-2 aria-pressed:border-primary aria-pressed:bg-primary-soft aria-pressed:text-primary-text"
              >
                {o.label}
              </button>
            ))}
          </div>
          <div>
            <button
              type="button"
              disabled={pending || tags.length === 0 || !p.reminderId}
              onClick={() => p.reminderId && run(() => setUsageTags(p.reminderId!, tags), t("usageSaved"))}
              className="min-h-11 rounded-control bg-primary px-4 text-sm font-medium text-primary-fg disabled:opacity-60"
            >
              {t("usageSave")}
            </button>
          </div>
        </fieldset>
      )}

      {p.code === "unused_check" && p.reminderId && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={p.title}>
          <button type="button" disabled={pending} className={BTN} onClick={() => run(() => answerUsage(p.reminderId!, true), t("thanks"))}>
            {t("yes")}
          </button>
          <button type="button" disabled={pending} className={BTN} onClick={() => run(() => answerUsage(p.reminderId!, false), t("thanks"))}>
            {t("no")}
          </button>
        </div>
      )}

      <details
        onToggle={(e) => {
          // megnyitva = látta: új → megnyitott (a hiba nem akadályozza a használatot)
          if ((e.currentTarget as HTMLDetailsElement).open && p.status === "new") void tipAction(p.id, "seen");
        }}
      >
        <summary className="min-h-11 cursor-pointer py-2.5 text-sm font-medium text-primary-text">{t("whyTitle")}</summary>
        <p className="pb-1 text-sm text-text-2">{p.why}</p>
      </details>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} className={BTN} onClick={() => run(() => tipAction(p.id, "snooze"), t("snoozed"))}>
          {t("snooze")}
        </button>
        <button type="button" disabled={pending} className={BTN} onClick={() => run(() => tipAction(p.id, "dismiss"), t("dismissed"))}>
          {t("dismiss")}
        </button>
        {p.code !== "unused_check" && (
          <button type="button" disabled={pending} className={BTN} onClick={() => run(() => tipAction(p.id, "done"), t("doneToast"))}>
            {t("done")}
          </button>
        )}
      </div>
    </article>
  );
}
