"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Notice } from "@/components/auth/notice";
import { SubmitButton } from "@/components/auth/submit-button";
import { TextField } from "@/components/auth/text-field";
import { OffsetChips } from "@/components/reminders/form/offset-chips";
import { useReminderErrorText } from "@/components/reminders/form/use-reminder-error";
import { updateNotificationSettings } from "@/lib/push/actions";

export type NotificationSettings = {
  remindersEnabled: boolean;
  offsets: number[];
  notifyTime: string;
  channelPush: boolean;
  channelEmail: boolean;
  hideDetails: boolean;
  weeklyDigest: boolean;
};

const CHECK = "flex min-h-11 items-start gap-3 text-sm";

// Profil → Értesítések: fő kapcsoló, alapértelmezések új emlékeztetőkhöz, csatornák, diszkrét mód, heti összefoglaló (§19.1)
export function NotificationSettingsForm({ initial }: { initial: NotificationSettings }) {
  const t = useTranslations("notifications.settings");
  const tf = useTranslations("reminders.form");
  const errorText = useReminderErrorText();
  const [state, action] = useActionState(updateNotificationSettings, null);
  const [v, setV] = useState(initial);
  const patch = (p: Partial<NotificationSettings>) => setV((s) => ({ ...s, ...p }));
  const fe = (state && !state.ok ? state.fieldErrors : undefined) ?? {};

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <label className="flex items-start gap-3 rounded-card border border-border bg-surface-2 p-4">
        <input
          type="checkbox"
          name="remindersEnabled"
          checked={v.remindersEnabled}
          onChange={(e) => patch({ remindersEnabled: e.target.checked })}
          className="mt-1 size-6 shrink-0 accent-primary"
        />
        <span>
          <span className="block text-lg font-semibold">{t("master")}</span>
          <span className="block text-sm text-text-2" aria-live="polite">
            {v.remindersEnabled ? t("masterOn") : t("masterOff")}
          </span>
        </span>
      </label>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-base font-semibold">{t("defaults")}</legend>
        <OffsetChips offsets={v.offsets} onChange={(offsets) => patch({ offsets })} error={fe.offsets ? errorText(fe.offsets[0]) : undefined} />
        <TextField
          name="notifyTime"
          type="time"
          label={tf("time")}
          value={v.notifyTime}
          onChange={(e) => patch({ notifyTime: e.target.value })}
          errors={fe.notifyTime}
          translateError={errorText}
        />
      </fieldset>

      <fieldset className="flex flex-col">
        <legend className="mb-1 text-base font-semibold">{t("channels")}</legend>
        <label className={CHECK}>
          <input type="checkbox" name="channelPush" checked={v.channelPush} onChange={(e) => patch({ channelPush: e.target.checked })} className="mt-0.5 size-5 accent-primary" />
          {tf("channelPush")}
        </label>
        <label className={CHECK}>
          <input type="checkbox" name="channelEmail" checked={v.channelEmail} onChange={(e) => patch({ channelEmail: e.target.checked })} className="mt-0.5 size-5 accent-primary" />
          {tf("channelEmail")}
        </label>
      </fieldset>

      <div className="flex flex-col">
        <label className={CHECK}>
          <input type="checkbox" name="hideDetails" checked={v.hideDetails} onChange={(e) => patch({ hideDetails: e.target.checked })} className="mt-0.5 size-5 accent-primary" />
          <span>
            <span className="block font-medium">{t("hideDetails")}</span>
            <span className="block text-text-2">{t("hideDetailsHint")}</span>
          </span>
        </label>
        <label className={CHECK}>
          <input type="checkbox" name="weeklyDigest" checked={v.weeklyDigest} onChange={(e) => patch({ weeklyDigest: e.target.checked })} className="mt-0.5 size-5 accent-primary" />
          <span>
            <span className="block font-medium">{t("digest")}</span>
            <span className="block text-text-2">{t("digestHint")}</span>
          </span>
        </label>
      </div>

      {state && !state.ok && state.code !== "validation" && <Notice variant="error">{t("saveFailed")}</Notice>}
      <FormAlert state={state && !state.ok && state.code === "validation" ? null : state} />
      {state?.ok && <Notice variant="success">{t("saved")}</Notice>}
      <div className="sm:max-w-40">
        <SubmitButton pendingLabel={t("saving")}>{t("save")}</SubmitButton>
      </div>
    </form>
  );
}
