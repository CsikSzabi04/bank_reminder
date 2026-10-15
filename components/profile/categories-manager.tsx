"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { TextField } from "@/components/auth/text-field";
import { CategoryIcon } from "@/components/categories/category-icon";
import { useReminderErrorText } from "@/components/reminders/form/use-reminder-error";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { CATEGORY_ICONS, categoryColorVar } from "@/lib/category-icons";
import { deleteCategory, saveCategory } from "@/lib/profile/finance-actions";

export type CustomCategory = { id: string; nameHu: string; nameEn: string; icon: string; colorSlot: number; kind: "bill" | "expense" | "both" };

const SLOTS = [1, 2, 3, 4, 5, 6, 7, 9] as const;
const KINDS = ["bill", "expense", "both"] as const;
const BLANK: CustomCategory = { id: "", nameHu: "", nameEn: "", icon: "tag", colorSlot: 9, kind: "both" };
const BTN = "inline-flex min-h-11 items-center gap-2 rounded-control border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2";
const CHIP =
  "flex min-h-11 cursor-pointer items-center rounded-full border border-border bg-surface px-4 text-sm font-medium text-text-2 has-checked:border-primary has-checked:bg-primary-soft has-checked:text-primary-text has-focus-visible:outline-2 has-focus-visible:outline-primary";

// Saját kategóriák (§19.1): név HU/EN, ikon, színcsoport, típus. A rendszer-kategóriák nem szerkeszthetők.
export function CategoriesManager({ items }: { items: CustomCategory[] }) {
  const t = useTranslations("profile.finance.categories");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<CustomCategory | null>(null);
  const [removing, setRemoving] = useState<CustomCategory | null>(null);
  const label = (c: CustomCategory) => (locale === "en" ? c.nameEn || c.nameHu : c.nameHu || c.nameEn);

  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 ? (
        <p className="text-text-2">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-card border border-border">
          {items.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-3 py-2">
              <CategoryIcon icon={c.icon} colorSlot={c.colorSlot} size={36} />
              <div className="min-w-0 flex-1">
                <span className="block truncate font-medium">{label(c)}</span>
                <span className="text-sm text-text-2">{t(`kinds.${c.kind}`)}</span>
              </div>
              <button type="button" aria-label={t("edit", { name: label(c) })} onClick={() => setEditing(c)} className="flex size-11 items-center justify-center rounded-control text-text-2 hover:bg-surface-2">
                <Pencil className="size-4" aria-hidden />
              </button>
              <button type="button" aria-label={t("remove", { name: label(c) })} onClick={() => setRemoving(c)} className="flex size-11 items-center justify-center rounded-control text-text-2 hover:bg-surface-2">
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div>
        <button type="button" className={BTN} onClick={() => setEditing(BLANK)}>
          <Plus className="size-4" aria-hidden />
          {t("add")}
        </button>
      </div>

      <BottomSheet open={editing !== null} onClose={() => setEditing(null)} title={editing?.id ? t("editTitle") : t("addTitle")}>
        {editing && (
          <CategoryForm
            key={editing.id || "new"}
            category={editing}
            onDone={() => {
              setEditing(null);
              router.refresh();
            }}
          />
        )}
      </BottomSheet>

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={t("removeTitle", { name: removing ? label(removing) : "" })}
        description={t("removeBody")}
        confirmLabel={t("removeConfirm")}
        destructive
        onConfirm={async () => {
          if (!removing) return;
          const res = await deleteCategory(removing.id);
          if (!res.ok) throw new Error("delete failed");
          toast.show({ message: t("removed"), tone: "success" });
          router.refresh();
        }}
      />
    </div>
  );
}

// Kontrollált mezők: hibás beküldés után a beírt értékek megmaradnak (a React 19 az nem-kontrollált mezőket visszaállítja)
function CategoryForm({ category, onDone }: { category: CustomCategory; onDone: () => void }) {
  const t = useTranslations("profile.finance.categories");
  const errorText = useReminderErrorText();
  const toast = useToast();
  const [state, action] = useActionState(saveCategory.bind(null, category.id || null), null);
  const [v, setV] = useState(category);
  const handled = useRef<typeof state>(null);
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  useEffect(() => {
    if (!state?.ok || handled.current === state) return;
    handled.current = state;
    toast.show({ message: t("saved"), tone: "success" });
    onDone();
  }, [state, toast, t, onDone]);

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <TextField name="nameHu" label={t("nameHu")} maxLength={40} value={v.nameHu} onChange={(e) => setV({ ...v, nameHu: e.target.value })} errors={fe?.nameHu} translateError={errorText} />
      <TextField name="nameEn" label={t("nameEn")} maxLength={40} value={v.nameEn} onChange={(e) => setV({ ...v, nameEn: e.target.value })} errors={fe?.nameEn} translateError={errorText} />
      <p className="-mt-2 text-sm text-text-2">{t("nameHint")}</p>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-text-2">{t("kind")}</legend>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <label key={k} className={CHIP}>
              <input type="radio" name="kind" value={k} checked={v.kind === k} onChange={() => setV({ ...v, kind: k })} className="sr-only" />
              {t(`kinds.${k}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-text-2">{t("icon")}</legend>
        <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto p-0.5" role="presentation">
          {Object.keys(CATEGORY_ICONS).map((key) => (
            <label
              key={key}
              className="flex size-11 cursor-pointer items-center justify-center rounded-control border border-border bg-surface has-checked:border-primary has-checked:bg-primary-soft has-focus-visible:outline-2 has-focus-visible:outline-primary"
            >
              <input type="radio" name="icon" value={key} checked={v.icon === key} onChange={() => setV({ ...v, icon: key })} className="sr-only" aria-label={key} />
              <CategoryIcon icon={key} colorSlot={v.icon === key ? v.colorSlot : 9} size={28} />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-text-2">{t("color")}</legend>
        <div className="flex flex-wrap gap-2">
          {SLOTS.map((slot) => (
            <label key={slot} className="flex size-11 cursor-pointer items-center justify-center rounded-full border-2 border-transparent has-checked:border-text has-focus-visible:outline-2 has-focus-visible:outline-primary">
              <input type="radio" name="colorSlot" value={slot} checked={v.colorSlot === slot} onChange={() => setV({ ...v, colorSlot: slot })} className="sr-only" aria-label={t("colorN", { n: slot })} />
              <span aria-hidden className="size-7 rounded-full" style={{ background: categoryColorVar(slot) }} />
            </label>
          ))}
        </div>
      </fieldset>

      <FormAlert state={state && !state.ok && state.fieldErrors ? null : state} />
      <SubmitButton pendingLabel={t("saving")}>{t("save")}</SubmitButton>
    </form>
  );
}
