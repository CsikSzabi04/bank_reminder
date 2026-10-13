"use client";

import { Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";
import type { ActionState } from "@/lib/action-state";
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
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [open, setOpen] = useState(defaultOpen);
  const [resetKey, setResetKey] = useState(0);
  const [state, action] = useActionState(addExpense, null);
  const handled = useRef<typeof state>(null);
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
        <ExpenseForm key={resetKey} action={action} state={state} categories={categories} today={today} />
      </BottomSheet>
    </>
  );
}

type ExpenseState = ReturnType<typeof useActionState<ActionState<{ id: string }> | null, FormData>>[0];

// Kontrollált mezők: a React 19 az akció után az nem-kontrollált mezőket visszaállítja, hibánál elveszne a beírt érték.
// A sikeres mentés után a szülő új `key`-jel újraépíti (üres űrlap).
function ExpenseForm({ action, state, categories, today }: { action: (fd: FormData) => void; state: ExpenseState; categories: ExpenseCategory[]; today: string }) {
  const t = useTranslations("expenses");
  const tc = useTranslations("common");
  const errorText = useReminderErrorText();
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [spentOn, setSpentOn] = useState(today);
  const [note, setNote] = useState("");
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <TextField
        name="amount"
        label={t("amount")}
        inputMode="decimal"
        autoComplete="off"
        autoFocus
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        errors={fe?.amount}
        translateError={errorText}
        required
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-text-2">{t("category")}</legend>
        <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto" role="presentation">
          <Chip name="categoryId" value="" label={t("noCategory")} checked={categoryId === ""} onSelect={() => setCategoryId("")} />
          {categories.map((c) => (
            <Chip
              key={c.id}
              name="categoryId"
              value={c.id}
              label={c.name}
              checked={categoryId === c.id}
              onSelect={() => setCategoryId(c.id)}
              icon={<CategoryIcon icon={c.icon} colorSlot={c.colorSlot} size={24} />}
            />
          ))}
        </div>
      </fieldset>
      <TextField name="spentOn" type="date" label={t("date")} value={spentOn} onChange={(e) => setSpentOn(e.target.value)} max={today} errors={fe?.spentOn} translateError={errorText} required />
      <TextField name="note" label={t("note")} hint={tc("optional")} maxLength={200} autoComplete="off" value={note} onChange={(e) => setNote(e.target.value)} errors={fe?.note} translateError={errorText} />
      <FormAlert state={state && !state.ok && state.fieldErrors ? null : state} />
      <SubmitButton pendingLabel={t("saving")}>{t("save")}</SubmitButton>
    </form>
  );
}

function Chip({ name, value, label, icon, checked, onSelect }: { name: string; value: string; label: string; icon?: React.ReactNode; checked: boolean; onSelect: () => void }) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-3 text-sm font-medium text-text-2",
        "has-checked:border-primary has-checked:bg-primary-soft has-checked:text-primary-text has-focus-visible:outline-2 has-focus-visible:outline-primary",
      )}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onSelect} className="sr-only" />
      {icon}
      {label}
    </label>
  );
}
