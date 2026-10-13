"use client";

import { Inbox } from "lucide-react";
import { useState } from "react";
import { BillList, BillRow } from "@/components/reminders/bill-row";
import { PayButton } from "@/components/reminders/pay-button";
import { RecurrenceText } from "@/components/reminders/recurrence-text";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonCard } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import type { ActionState } from "@/lib/action-state";
import { FIXTURE_ROWS, FIXTURE_TODAY } from "@/lib/fixtures/reminders";

const BTN = "min-h-11 rounded-control border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2";
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// Interaktív állapotok: a /dev/ui-n valós adat nélkül kipróbálhatók
export function Demos() {
  const toast = useToast();
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [failNext, setFailNext] = useState(false);

  const ok: ActionState = { ok: true };
  const pay = async (): Promise<ActionState> => {
    await wait(700);
    return failNext ? { ok: false, code: "upstream_failed" } : ok;
  };

  return (
    <>
      <section>
        <h2 className="mb-3 text-lg font-semibold">BillRow · állapotok</h2>
        <BillList label="BillRow">
          {FIXTURE_ROWS.map((r) => (
            <BillRow
              key={r.id}
              name={r.name}
              amount={r.amount}
              currency={r.currency}
              dueDate={r.dueDate}
              today={FIXTURE_TODAY}
              status={r.status}
              category={r.category}
              demo={r.demo}
              notifyOff={r.notifyOff}
              href={`/dev/ui#${r.id}`}
              subtitle={<RecurrenceText unit={r.unit} every={r.every} startDate={r.startDate} monthEnd={r.monthEnd} />}
              action={
                r.status === "upcoming" ? (
                  <PayButton status="upcoming" name={r.name} onPay={pay} onUndo={async () => (await wait(300), ok)} />
                ) : undefined
              }
            />
          ))}
        </BillList>
        <label className="mt-3 flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" checked={failNext} onChange={(e) => setFailNext(e.target.checked)} className="size-5 accent-primary" />
          PayButton: a következő mentés hibával végződjön
        </label>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">EmptyState · Skeleton</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <EmptyState icon={Inbox} title="Még nincs emlékeztetőd" body="Vedd fel az elsőt 20 másodperc alatt — és mi időben szólunk.">
            <button type="button" className={BTN}>
              Új emlékeztető
            </button>
          </EmptyState>
          <SkeletonCard rows={3} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">BottomSheet · ConfirmDialog · Toast</h2>
        <div className="flex flex-wrap gap-3">
          <button type="button" className={BTN} onClick={() => setSheet(true)}>
            BottomSheet
          </button>
          <button type="button" className={BTN} onClick={() => setConfirm(true)}>
            ConfirmDialog (törlés)
          </button>
          <button type="button" className={BTN} onClick={() => toast.show({ message: "Netflix: kifizetve", action: { label: "Visszavonás", onClick: () => {} } })}>
            Toast + Visszavonás
          </button>
          <button type="button" className={BTN} onClick={() => toast.show({ tone: "error", message: "Nem sikerült menteni. Próbáld újra." })}>
            Toast (hiba)
          </button>
        </div>
        <BottomSheet open={sheet} onClose={() => setSheet(false)} title="Mikor emlékeztessünk?" description="Válassz egy időpontot.">
          <div className="flex flex-col gap-2">
            {["Holnap", "3 nap múlva", "Jövő héten"].map((x) => (
              <button key={x} type="button" className={BTN} onClick={() => setSheet(false)}>
                {x}
              </button>
            ))}
          </div>
        </BottomSheet>
        <ConfirmDialog
          open={confirm}
          onClose={() => setConfirm(false)}
          title="Törlöd az emlékeztetőt?"
          description="Az esedékességek és a hozzájuk tartozó értesítések is törlődnek."
          confirmLabel="Törlés"
          destructive
          onConfirm={() => wait(500)}
        />
      </section>
    </>
  );
}
