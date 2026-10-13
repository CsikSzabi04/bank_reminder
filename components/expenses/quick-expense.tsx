"use client";

import { Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { TextField } from "@/components/auth/text-field";
import { CategoryIcon } from "@/components/categories/category-icon";
import { useReminderErrorText } from "@/components/reminders/form/use-reminder-error";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useToast } from "@/components/ui/toast";
import { addExpense, deleteExpense } from "@/lib/budgets/actions";
import { cn } from "@/lib/utils";

export type ExpenseCategory = { id: string; name: string; icon: string; colorSlot: number };

// Gyors kiadás (F-12): összeg + kategória-chipek (leggyakoribbak elöl) + dátum + megjegyzés; mentés = 2 koppintás.
// Visszavonás a toastról. A `?add=expense` (FAB-menü) nyitva rendereli a lapot, zárás után az URL-ből eltűnik.
export function QuickExpense({
  categories,
  today,
  defaultOpen = false,
  triggerClassName,
}: {
  categories: ExpenseCategory[];
  today: string;
  defaultOpen?: boolean;
  triggerClassName: string;
}) {
  const t = useTranslations("expenses");
  const tc = useTranslations("common");
  const errorText = useReminderErrorText();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [open, setOpen] = useState(defaultOpen);
  const [resetKey, setResetKey] = useState(0);
  const [state, action] = useActionState(addExpense, null);
  const handled = useRef<typeof state>(null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  const close = () => {
    setOpen(false);
    if (defaultOpen) router.replace(pathname, { scroll: false });
  };

  // a sikeres mentés után: toast visszavonással, a lap bezár, az űrlap kiürül, a szerver-adat frissül
  useEffect(() => {
    if (!state?.ok || handled.current === state) return;
    handled.current = state;
    const id = state.data?.id;
    toast.show({
      message: t("saved"),
      tone: "success",
      action: id
        ? {
            label: t("undo"),
            onClick: () => {
              void deleteExpense(id).then(() => router.refresh());
            },
          }
        : undefined,
    });
    setResetKey((k) => k + 1);
    setOpen(false);
    if (defaultOpen) router.replace(pathname, { scroll: false });
    router.refresh();
  }, [state, toast, t, router, pathname, defaultOpen]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName}>
        <Plus className="size-4" aria-hidden />
        {t("title")}
      </button>
      <BottomSheet open={open} onClose={close} title={t("title")}>
        <form key={resetKey} action={action} noValidate className="flex flex-col gap-4">
          <TextField
            name="amount"
            label={t("amount")}
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            errors={fe?.amount}
            translateError={errorText}
            required
          />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-text-2">{t("category")}</legend>
            <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto" role="presentation">
              <Chip name="categoryId" value="" label={t("noCategory")} defaultChecked />
              {categories.map((c) => (
                <Chip key={c.id} name="categoryId" value={c.id} label={c.name} icon={<CategoryIcon icon={c.icon} colorSlot={c.colorSlot} size={24} />} />
              ))}
            </div>
          </fieldset>
          <TextField name="spentOn" type="date" label={t("date")} defaultValue={today} max={today} errors={fe?.spentOn} translateError={errorText} required />
          <TextField name="note" label={t("note")} hint={tc("optional")} maxLength={200} autoComplete="off" errors={fe?.note} translateError={errorText} />
          <FormAlert state={state && !state.ok && state.fieldErrors ? null : state} />
          <SubmitButton pendingLabel={t("saving")}>{t("save")}</SubmitButton>
        </form>
      </BottomSheet>
    </>
  );
}

function Chip({ name, value, label, icon, defaultChecked }: { name: string; value: string; label: string; icon?: React.ReactNode; defaultChecked?: boolean }) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-3 text-sm font-medium text-text-2",
        "has-checked:border-primary has-checked:bg-primary-soft has-checked:text-primary-text has-focus-visible:outline-2 has-focus-visible:outline-primary",
      )}
    >
      <input type="radio" name={name} value={value} defaultChecked={defaultChecked} className="sr-only" />
      {icon}
      {label}
    </label>
  );
}
