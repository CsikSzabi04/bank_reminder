import { Ban, CircleAlert, CircleCheck, Clock, TriangleAlert, type LucideIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { AccountList } from "@/components/bank/account-list";
import { ConnectionActions } from "@/components/bank/connection-actions";
import { connectionHealth, type ConnectionState } from "@/lib/bank/connections";
import type { BankConnection } from "@/lib/bank/types";
import { formatAge } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

const STATUS: Record<ConnectionState, { icon: LucideIcon; tone: string }> = {
  active: { icon: CircleCheck, tone: "bg-success/15 text-success-text" },
  soon: { icon: Clock, tone: "bg-warning/20 text-warning-text" },
  expired: { icon: TriangleAlert, tone: "bg-danger/15 text-danger-text" },
  error: { icon: CircleAlert, tone: "bg-danger/15 text-danger-text" },
  revoked: { icon: Ban, tone: "bg-surface-2 text-text-2" },
};

const BAR_TONE: Record<ConnectionState, string> = {
  active: "bg-success",
  soon: "bg-warning",
  expired: "bg-danger",
  error: "bg-danger",
  revoked: "bg-text-muted",
};

// Egy bank-kapcsolat állapot-kártyája (advanced.md §8.2): állapot ikonnal+szöveggel, hátralévő napok + sáv,
// utolsó szinkron, számlák, műveletek. A `now` paraméter csak a teszthez/demóhoz kell.
export async function ConnectionCard({
  connection,
  timeZone,
  now = new Date(),
}: {
  connection: BankConnection;
  timeZone: string;
  now?: Date;
}) {
  const t = await getTranslations("bank");
  const locale = (await getLocale()) as Locale;
  const health = connectionHealth(connection, timeZone, now);
  const { icon: Icon, tone } = STATUS[health.state];
  const percent = Math.round(health.elapsed * 100);

  const lastSync = connection.lastSyncAt
    ? t(connection.lastSyncOk === false ? "connection.lastSync.failed" : "connection.lastSync.ok", {
        when: formatAge(connection.lastSyncAt, now, locale),
      })
    : t("connection.lastSync.never");

  const hint =
    health.state === "expired" ? t("connection.expiredHint") : health.state === "error" ? t("connection.errorHint") : health.state === "revoked" ? t("connection.revokedHint") : null;

  return (
    <section aria-label={connection.aspspName} className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{connection.aspspName}</h2>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium", tone)}>
          <Icon className="size-4" aria-hidden />
          {t(`connection.status.${health.state}`)}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <p className="font-medium tabular-nums">
          {health.daysLeft >= 0 ? t("connection.daysLeft", { count: health.daysLeft }) : t("connection.expiredAgo", { count: -health.daysLeft })}
        </p>
        <div
          role="progressbar"
          aria-label={t("connection.elapsedLabel")}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-2 overflow-hidden rounded-full bg-surface-2"
        >
          <div className={cn("h-full rounded-full", BAR_TONE[health.state])} style={{ width: `${percent}%` }} />
        </div>
        {hint && <p className="text-sm text-text-2">{hint}</p>}
        <p className="text-sm text-text-2">{lastSync}</p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-text-2">{t("connection.accounts")}</h3>
        <AccountList accounts={connection.accounts} />
      </div>

      <ConnectionActions
        connectionId={connection.id}
        aspspName={connection.aspspName}
        aspspCountry={connection.aspspCountry}
        canRefresh={health.state === "active" || health.state === "soon"}
        timeZone={timeZone}
      />
    </section>
  );
}
