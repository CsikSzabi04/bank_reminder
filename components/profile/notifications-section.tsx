import { createHash } from "node:crypto";
import { CalendarDays } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { NotificationSettingsForm } from "@/components/push/notification-settings-form";
import { PushPanel, type DeviceView } from "@/components/push/push-panel";
import { getBankAccess } from "@/lib/bank/queries";
import { createClient } from "@/utils/supabase/server";

const CARD = "flex flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-card";

// Profil → Értesítések (§19.1): beállítások · ezen az eszközön · eszközeim · naptár-link tartalék
export async function NotificationsSection({ userId }: { userId: string }) {
  const t = await getTranslations("notifications");
  const supabase = createClient(await cookies());
  const [profile, subs, bank] = await Promise.all([
    supabase
      .from("profiles")
      .select("reminders_enabled, default_offsets, default_notify_time, channel_push, channel_email, notify_hide_details, weekly_digest, budget_alerts")
      .eq("id", userId)
      .single(),
    supabase.from("push_subscriptions").select("id, endpoint, platform, label, last_success_at, disabled_at").order("created_at", { ascending: false }),
    getBankAccess(),
  ]);
  if (!profile.data) return null;
  const p = profile.data;

  // a végpont (push-capability URL) nem kerül a kliensre: csak az ujjlenyomata, az „Ez az eszköz" jelöléshez
  const devices: DeviceView[] = (subs.data ?? []).map((s) => ({
    id: s.id,
    hash: createHash("sha256").update(s.endpoint).digest("hex"),
    platform: s.platform,
    label: s.label,
    lastSuccessAt: s.last_success_at,
    disabled: s.disabled_at !== null,
  }));

  return (
    <div className="flex flex-col gap-4">
      <section className={CARD} aria-labelledby="notif-settings">
        <h2 id="notif-settings" className="text-lg font-semibold">
          {t("settings.title")}
        </h2>
        <NotificationSettingsForm
          initial={{
            remindersEnabled: p.reminders_enabled,
            offsets: p.default_offsets,
            notifyTime: p.default_notify_time.slice(0, 5),
            channelPush: p.channel_push,
            channelEmail: p.channel_email,
            hideDetails: p.notify_hide_details,
            weeklyDigest: p.weekly_digest,
            budgetAlerts: p.budget_alerts,
          }}
          showBankConsent={bank.syncAllowed}
        />
      </section>

      <section className={CARD} aria-labelledby="notif-device">
        <h2 id="notif-device" className="text-lg font-semibold">
          {t("settings.thisDevice")}
        </h2>
        <PushPanel vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null} devices={devices} globalEnabled={p.reminders_enabled} />
      </section>

      <section className={CARD} aria-labelledby="notif-calendar">
        <h2 id="notif-calendar" className="text-lg font-semibold">
          {t("settings.calendar")}
        </h2>
        <p className="text-sm text-text-2">{t("settings.calendarHint")}</p>
        <div>
          <Link href="/calendar" className="inline-flex min-h-11 items-center gap-2 rounded-control border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2">
            <CalendarDays className="size-4" aria-hidden />
            {t("settings.calendar")}
          </Link>
        </div>
      </section>
    </div>
  );
}
