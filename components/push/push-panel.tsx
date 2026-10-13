"use client";

import { BellRing, Send, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Notice } from "@/components/auth/notice";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { removeDevice, sendTestPush } from "@/lib/push/actions";
import { disablePush, enablePush } from "@/lib/push-enable";
import { pushSupport, sha256Hex, type PushReason } from "@/lib/push-client";
import { PushDiagnostics, type DiagRow } from "./push-diagnostics";

export type DeviceView = {
  id: string;
  /** a végpont SHA-256 ujjlenyomata (a végpont maga nem kerül a kliensre) */
  hash: string;
  platform: string | null;
  label: string | null;
  lastSuccessAt: string | null;
  disabled: boolean;
};

type Status = {
  https: boolean;
  sw: boolean;
  standalone: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
  hash: string | null;
  supported: boolean;
  iosNeedsInstall: boolean;
};

const BTN = "inline-flex min-h-11 items-center gap-2 rounded-control border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2 disabled:opacity-60";

async function readStatus(): Promise<Status> {
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const support = pushSupport(standalone);
  const https = window.isSecureContext;
  if (!support.supported) {
    return { https, sw: false, standalone, permission: "unsupported", subscribed: false, hash: null, supported: false, iosNeedsInstall: false };
  }
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return {
    https,
    sw: Boolean(reg?.active),
    standalone,
    permission: Notification.permission,
    subscribed: Boolean(sub),
    hash: sub ? await sha256Hex(sub.endpoint) : null,
    supported: true,
    iosNeedsInstall: support.iosNeedsInstall,
  };
}

// „Ezen az eszközön": bekapcsolás, diagnosztika, teszt-értesítés és az eszközlista (§12.9–12.10, §19.1)
export function PushPanel({ vapidKey, devices, globalEnabled }: { vapidKey: string | null; devices: DeviceView[]; globalEnabled: boolean }) {
  const tp = useTranslations("notifications.push");
  const td = useTranslations("notifications.push.diag");
  const tv = useTranslations("notifications.devices");
  const locale = useLocale() as Locale;
  const toast = useToast();
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [problem, setProblem] = useState<PushReason | null>(null);
  const [busy, startTransition] = useTransition();

  const refresh = useCallback(() => {
    void readStatus().then(setStatus);
  }, []);
  useEffect(refresh, [refresh]);

  const mine = devices.find((d) => d.hash === status?.hash);
  const active = Boolean(status?.subscribed && mine && !mine.disabled && status.permission === "granted");

  const enable = () =>
    startTransition(async () => {
      setProblem(null);
      const res = await enablePush(vapidKey, status?.standalone ?? false);
      if (res.ok) toast.show({ message: tp("enabled") });
      else setProblem(res.reason);
      refresh();
      router.refresh();
    });

  const disable = () =>
    startTransition(async () => {
      await disablePush();
      if (mine) await removeDevice(mine.id);
      toast.show({ message: tp("disabled") });
      refresh();
      router.refresh();
    });

  const test = () =>
    startTransition(async () => {
      const res = await sendTestPush();
      if (res.ok) {
        toast.show(res.data!.devices === 0 ? { tone: "error", message: tp("testNone") } : { message: tp("testSent", { sent: res.data!.sent, devices: res.data!.devices }) });
      } else {
        toast.show({ tone: "error", message: res.code === "rate_limited" ? tp("testRateLimited") : tp("testFailed") });
      }
    });

  const remove = (d: DeviceView) =>
    startTransition(async () => {
      const res = await removeDevice(d.id);
      toast.show(res.ok ? { message: tv("removed") } : { tone: "error", message: tv("removeFailed") });
      if (res.ok && d.hash === status?.hash) await disablePush();
      refresh();
      router.refresh();
    });

  const rows: DiagRow[] = status
    ? [
        { key: "https", label: td("https"), state: status.https ? "ok" : "fail", text: status.https ? td("ok") : td("fail") },
        { key: "sw", label: td("serviceWorker"), state: status.sw ? "ok" : "warn", text: status.sw ? td("ok") : td("na") },
        { key: "installed", label: td("installed"), state: status.standalone ? "ok" : "warn", text: status.standalone ? td("ok") : td("na") },
        {
          key: "permission",
          label: td("permission"),
          state: status.permission === "granted" ? "ok" : status.permission === "denied" ? "fail" : "warn",
          text: status.permission === "granted" ? td("granted") : status.permission === "denied" ? td("denied") : status.permission === "unsupported" ? td("na") : td("prompt"),
        },
        { key: "sub", label: td("subscription"), state: status.subscribed ? "ok" : "warn", text: status.subscribed ? td("ok") : td("na") },
        { key: "server", label: td("server"), state: mine && !mine.disabled ? "ok" : "warn", text: mine && !mine.disabled ? td("ok") : td("na") },
        {
          key: "last",
          label: td("lastSuccess"),
          state: mine?.lastSuccessAt ? "ok" : "warn",
          text: mine?.lastSuccessAt ? formatDate(mine.lastSuccessAt, locale, Intl.DateTimeFormat().resolvedOptions().timeZone) : td("never"),
        },
        { key: "global", label: td("global"), state: globalEnabled ? "ok" : "fail", text: globalEnabled ? td("ok") : td("fail") },
      ]
    : [];

  const reasonText = (r: PushReason) => (r === "brave_push_service" ? tp("brave") : tp(`reason.${r}`));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-text-2" aria-live="polite">
          {active ? tp("on") : tp("off")}
        </p>
        {problem && <Notice variant="error">{reasonText(problem)}</Notice>}
        <div className="flex flex-wrap gap-2">
          {active ? (
            <button type="button" className={BTN} disabled={busy} onClick={disable}>
              {tp("disable")}
            </button>
          ) : (
            <button type="button" className={BTN} disabled={busy} onClick={enable}>
              <BellRing className="size-4" aria-hidden />
              {busy ? tp("enabling") : tp("enable")}
            </button>
          )}
          <button type="button" className={BTN} disabled={busy || !active} onClick={test}>
            <Send className="size-4" aria-hidden />
            {tp("test")}
          </button>
        </div>
      </div>

      {status && <PushDiagnostics rows={rows} />}

      <section aria-labelledby="devices-title" className="flex flex-col gap-2">
        <h3 id="devices-title" className="text-sm font-semibold">
          {tv("title")}
        </h3>
        {devices.length === 0 ? (
          <p className="text-sm text-text-2">{tv("none")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-control border border-border">
            {devices.map((d) => {
              const label = d.label || d.platform || "—";
              return (
                <li key={d.id} className="flex items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      <span className="truncate">{label}</span>
                      {d.hash === status?.hash && (
                        <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary-text">{tv("thisDevice")}</span>
                      )}
                      {d.disabled && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-text-2">{tv("disabled")}</span>}
                    </p>
                    <p className="text-sm text-text-2">
                      {d.lastSuccessAt ? tv("lastSuccess", { date: formatDate(d.lastSuccessAt, locale, Intl.DateTimeFormat().resolvedOptions().timeZone) }) : tv("never")}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => remove(d)}
                    aria-label={tv("removeAria", { label })}
                    className="flex size-11 shrink-0 items-center justify-center rounded-control text-text-2 hover:bg-surface-2 disabled:opacity-60"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
