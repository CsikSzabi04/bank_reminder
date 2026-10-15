import { Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { BankFlashBanner } from "@/components/bank/bank-flash";
import { ConnectPanel } from "@/components/bank/connect-panel";
import { ConnectionCard } from "@/components/bank/connection-card";
import { ConsentTimeline } from "@/components/bank/consent-timeline";
import type { BankFlash } from "@/lib/bank/callback";
import { connectionHealth } from "@/lib/bank/connections";
import { getAspsps, getBankConnections } from "@/lib/bank/queries";

const CARD = "rounded-card border border-border bg-surface p-5 shadow-card";

// Bank-összekötés (Enable Banking), advanced.md §8.2: kapcsolat-kártyák + kötelező értesítési ütemterv + összekötés.
// Enable-jogosultság nélkül (§2.1) csak az őszinte magyarázat látszik, a többi rejtett.
export async function OverviewSection({
  syncAllowed,
  timeZone,
  flash,
}: {
  syncAllowed: boolean;
  timeZone: string;
  flash: BankFlash | null;
}) {
  const t = await getTranslations("bank.overview");

  if (!syncAllowed) {
    return (
      <div className="flex flex-col gap-4">
        {flash && <BankFlashBanner flash={flash} />}
        <section className={`${CARD} flex flex-col gap-3`}>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Lock className="size-5 text-text-2" aria-hidden />
            {t("title")}
          </h2>
          <p>{t("restricted.body")}</p>
          <p className="text-sm text-text-2">{t("restricted.hint")}</p>
        </section>
      </div>
    );
  }

  const [connections, aspsps] = await Promise.all([getBankConnections(), getAspsps()]);
  const now = new Date();

  return (
    <div className="flex flex-col gap-4">
      {flash && <BankFlashBanner flash={flash} />}
      {connections.map((connection) => {
        const { state } = connectionHealth(connection, timeZone, now);
        return (
          <div key={connection.id} className="flex flex-col gap-4">
            <ConnectionCard connection={connection} timeZone={timeZone} now={now} />
            {(state === "active" || state === "soon") && (
              <ConsentTimeline validUntil={connection.validUntil} authorizedAt={connection.authorizedAt} timeZone={timeZone} now={now} />
            )}
          </div>
        );
      })}
      <ConnectPanel
        banks={aspsps.ok ? aspsps.banks : []}
        listError={aspsps.ok ? null : aspsps.code}
        another={connections.length > 0}
      />
    </div>
  );
}
