"use client";

import { LoaderCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { pollIngestEvents, type PollResult } from "@/lib/bank/ingest-actions";
import { formatMoney } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";

const POLL_MS = 3000;
const TIMEOUT_S = 90;

type Phase = { kind: "idle" } | { kind: "waiting"; since: string; seconds: number } | { kind: "done"; result: PollResult } | { kind: "timeout" } | { kind: "error" };

// Teszt-várakozás: a „Teszt indítása" után 3 másodpercenként megnézzük, érkezett-e esemény (PII-mentes napló: app + kimenet),
// és ha felvétel történt, mit olvastunk ki. 90 mp után feladja. A megállás a komponens lecsatlakozásakor is biztosított.
export function IngestTest() {
  const t = useTranslations("bank.android");
  const locale = useLocale() as Locale;
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const stopped = useRef(false);

  useEffect(() => {
    stopped.current = false;
    return () => {
      stopped.current = true;
    };
  }, []);

  useEffect(() => {
    if (phase.kind !== "waiting") return;
    const { since, seconds } = phase;
    const timer = setTimeout(async () => {
      const res = await pollIngestEvents(since);
      if (stopped.current) return;
      if (!res.ok || !res.data) return setPhase({ kind: "error" });
      if (res.data.events.length > 0) return setPhase({ kind: "done", result: res.data });
      if (seconds + POLL_MS / 1000 >= TIMEOUT_S) return setPhase({ kind: "timeout" });
      setPhase({ kind: "waiting", since, seconds: seconds + POLL_MS / 1000 });
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  const latest = phase.kind === "done" ? phase.result.events[0] : null;
  const parsed = phase.kind === "done" ? phase.result.parsed : null;

  return (
    <section aria-labelledby="ingest-test-title" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5 shadow-card">
      <h3 id="ingest-test-title" className="text-lg font-semibold">
        {t("test.title")}
      </h3>
      <p className="text-sm text-text-2">{t("test.hint")}</p>
      <div>
        <button
          type="button"
          disabled={phase.kind === "waiting"}
          onClick={() => setPhase({ kind: "waiting", since: new Date().toISOString(), seconds: 0 })}
          className="min-h-11 rounded-control border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2 disabled:opacity-60"
        >
          {t("test.start")}
        </button>
      </div>
      <div aria-live="polite" className="text-sm">
        {phase.kind === "waiting" && (
          <p className="flex items-center gap-2 text-text-2">
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            {t("test.waiting", { seconds: phase.seconds })}
          </p>
        )}
        {phase.kind === "timeout" && <p className="text-danger-text">{t("test.timeout")}</p>}
        {phase.kind === "error" && <p className="text-danger-text">{t("test.failed")}</p>}
        {latest && (
          <div className="flex flex-col gap-1">
            <p className="font-medium">{t("test.arrived")}</p>
            <p>{t(`outcome.${latest.outcome}`)}</p>
            {parsed && (
              <p className="text-text-2">
                {t("test.parsed", { merchant: parsed.merchant ?? t("test.noMerchant"), amount: formatMoney(parsed.amount, parsed.currency, locale) })}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
