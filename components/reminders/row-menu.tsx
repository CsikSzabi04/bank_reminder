"use client";

import { Clock, Ellipsis, Pause, Pencil, Play, SkipForward, Trash2, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState, useTransition } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import type { ActionState } from "@/lib/action-state";
import { deleteReminder, setReminderActive, skipOccurrence, snoozeOccurrence } from "@/lib/reminders/actions";

const ITEM =
  "flex min-h-12 w-full items-center gap-3 rounded-control px-3 text-left text-base hover:bg-surface-2 disabled:opacity-60";

function Item({ icon: Icon, children, onClick, disabled }: { icon: LucideIcon; children: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className={ITEM} onClick={onClick} disabled={disabled}>
      <Icon className="size-5 text-text-2" aria-hidden />
      {children}
    </button>
  );
}

// "⋯" menü: szerkesztés, halasztás, kihagyás, szüneteltetés, törlés (a destruktív megerősítéssel)
export function RowMenu({
  reminderId,
  occurrenceId,
  name,
  active,
  afterDelete,
}: {
  reminderId: string;
  /** a következő esedékesség; nélküle (szüneteltetett/lezárt) nincs halasztás/kihagyás */
  occurrenceId: string | null;
  name: string;
  active: boolean;
  /** a törlés után (pl. navigáció a listára a részletoldalról) */
  afterDelete?: () => void;
}) {
  const t = useTranslations("reminders");
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<ActionState>, doneKey: "skipped" | "snoozed" | "paused" | "resumed") =>
    startTransition(async () => {
      const res = await action();
      setOpen(false);
      setSnoozeOpen(false);
      toast.show(res.ok ? { message: t(`toast.${doneKey}`, { name }) } : { tone: "error", message: t("toast.failed") });
    });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("menu.open", { name })}
        aria-haspopup="dialog"
        className="flex size-11 shrink-0 items-center justify-center rounded-control text-text-2 hover:bg-surface-2"
      >
        <Ellipsis className="size-5" aria-hidden />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={name}>
        <div className="flex flex-col">
          <Link href={`/reminders/${reminderId}/edit`} className={ITEM} onClick={() => setOpen(false)}>
            <Pencil className="size-5 text-text-2" aria-hidden />
            {t("menu.edit")}
          </Link>
          {occurrenceId && active && (
            <>
              <Item icon={Clock} onClick={() => { setOpen(false); setSnoozeOpen(true); }}>
                {t("menu.snooze")}
              </Item>
              <Item icon={SkipForward} disabled={pending} onClick={() => run(() => skipOccurrence(occurrenceId), "skipped")}>
                {t("menu.skip")}
              </Item>
            </>
          )}
          <Item
            icon={active ? Pause : Play}
            disabled={pending}
            onClick={() => run(() => setReminderActive(reminderId, !active), active ? "paused" : "resumed")}
          >
            {t(active ? "menu.pause" : "menu.resume")}
          </Item>
          <Item icon={Trash2} onClick={() => { setOpen(false); setConfirmDelete(true); }}>
            {t("menu.delete")}
          </Item>
        </div>
      </BottomSheet>

      {occurrenceId && (
        <BottomSheet open={snoozeOpen} onClose={() => setSnoozeOpen(false)} title={t("menu.snooze")}>
          <div className="flex flex-col">
            {([1, 3, 7] as const).map((days) => (
              <Item key={days} icon={Clock} disabled={pending} onClick={() => run(() => snoozeOccurrence(occurrenceId, days), "snoozed")}>
                {t(`menu.snooze${days}`)}
              </Item>
            ))}
          </div>
        </BottomSheet>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t("menu.deleteTitle")}
        description={t("menu.deleteBody")}
        confirmLabel={t("menu.delete")}
        destructive
        onConfirm={async () => {
          const res = await deleteReminder(reminderId);
          if (!res.ok) throw new Error("delete failed"); // a ConfirmDialog hibaként mutatja
          toast.show({ message: t("toast.deleted", { name }) });
          afterDelete?.();
        }}
      />
    </>
  );
}
