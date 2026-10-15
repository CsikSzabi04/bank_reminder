"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import type { CategoryChoice } from "@/components/bank/pending-list";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import type { MerchantRule } from "@/lib/bank/rules";
import { deleteMerchantRule, saveMerchantRule } from "@/lib/bank/rules-actions";
import type { RulesError } from "@/lib/bank/rules-service";

const BTN =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2 disabled:opacity-60";
const FIELD = "min-h-11 rounded-control border border-border bg-surface px-3";

function RuleRow({ rule, categories }: { rule: MerchantRule; categories: CategoryChoice[] }) {
  const t = useTranslations("bank.rules");
  const router = useRouter();
  const toast = useToast();
  const keyId = useId();
  const catId = useId();
  const [editing, setEditing] = useState(false);
  const [key, setKey] = useState(rule.matchKey);
  const [categoryId, setCategoryId] = useState(rule.categoryId);
  const [error, setError] = useState<RulesError | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const categoryName = categories.find((c) => c.id === rule.categoryId)?.name ?? t("unknownCategory");

  const save = () =>
    startTransition(async () => {
      setError(null);
      const res = await saveMerchantRule({ id: rule.id, matchKey: key, categoryId });
      if (res.ok) {
        toast.show({ message: t("ruleSaved"), tone: "success" });
        setEditing(false);
        router.refresh();
        return;
      }
      setError((res.reason as RulesError | undefined) ?? "failed");
    });

  if (editing) {
    return (
      <li className="flex flex-col gap-3 px-4 py-4">
        <div className="flex flex-col gap-1">
          <label htmlFor={keyId} className="text-sm font-medium">
            {t("merchantLabel")}
          </label>
          <input id={keyId} value={key} onChange={(e) => setKey(e.target.value)} maxLength={80} className={FIELD} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={catId} className="text-sm font-medium">
            {t("categoryColumn")}
          </label>
          <select id={catId} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={FIELD}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger-text">
            {t(`error.${error}`)}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={save} className="min-h-11 rounded-control bg-primary px-5 text-sm font-medium text-primary-fg disabled:opacity-60">
            {t("save")}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setEditing(false);
              setKey(rule.matchKey);
              setCategoryId(rule.categoryId);
              setError(null);
            }}
            className={BTN}
          >
            {t("cancel")}
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{rule.matchKey}</p>
        <p className="text-sm text-text-2">
          {categoryName} · {t("hits", { count: rule.hits })}
        </p>
      </div>
      <button type="button" onClick={() => setEditing(true)} aria-label={t("editRule", { name: rule.matchKey })} className="flex size-11 shrink-0 items-center justify-center rounded-control text-text-2 hover:bg-surface-2">
        <Pencil className="size-4" aria-hidden />
      </button>
      <button type="button" onClick={() => setConfirm(true)} aria-label={t("deleteRule", { name: rule.matchKey })} className="flex size-11 shrink-0 items-center justify-center rounded-control text-text-2 hover:bg-surface-2">
        <Trash2 className="size-4" aria-hidden />
      </button>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t("deleteTitle")}
        description={t("deleteBody", { name: rule.matchKey })}
        confirmLabel={t("deleteConfirm")}
        destructive
        onConfirm={async () => {
          const res = await deleteMerchantRule(rule.id);
          if (!res.ok) throw new Error("delete_failed");
          toast.show({ message: t("ruleDeleted"), tone: "success" });
          router.refresh();
        }}
      />
    </li>
  );
}

// Új szabály kézzel: kereskedő neve (részlet is elég) + kategória
function NewRuleForm({ categories }: { categories: CategoryChoice[] }) {
  const t = useTranslations("bank.rules");
  const router = useRouter();
  const toast = useToast();
  const keyId = useId();
  const catId = useId();
  const [key, setKey] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<RulesError | null>(null);
  const [pending, startTransition] = useTransition();

  const add = () =>
    startTransition(async () => {
      setError(null);
      const res = await saveMerchantRule({ matchKey: key, categoryId });
      if (res.ok) {
        toast.show({ message: t("ruleSaved"), tone: "success" });
        setKey("");
        setCategoryId("");
        router.refresh();
        return;
      }
      setError((res.reason as RulesError | undefined) ?? "failed");
    });

  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-4">
      <h3 className="font-semibold">{t("newRule")}</h3>
      <div className="flex flex-col gap-1">
        <label htmlFor={keyId} className="text-sm font-medium">
          {t("merchantLabel")}
        </label>
        <input id={keyId} value={key} onChange={(e) => setKey(e.target.value)} maxLength={80} className={FIELD} aria-describedby={`${keyId}-hint`} />
        <p id={`${keyId}-hint`} className="text-sm text-text-2">
          {t("merchantHint")}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={catId} className="text-sm font-medium">
          {t("categoryColumn")}
        </label>
        <select id={catId} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={FIELD}>
          <option value="">{t("choose")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger-text">
          {t(`error.${error}`)}
        </p>
      )}
      <div>
        <button type="button" disabled={pending || !key.trim() || !categoryId} onClick={add} className="min-h-11 rounded-control bg-primary px-5 text-sm font-medium text-primary-fg disabled:opacity-60">
          {t("addRule")}
        </button>
      </div>
    </div>
  );
}

// Szabályaim (szerkeszthető) + rendszer-javaslatok (csak olvasható, javaslatként jelölve); az új szabály űrlapja
export function RulesManager({ rules, categories }: { rules: MerchantRule[]; categories: CategoryChoice[] }) {
  const t = useTranslations("bank.rules");
  const own = rules.filter((r) => !r.system);
  const system = rules.filter((r) => r.system);
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? t("unknownCategory");

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="own-rules" className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
        <h2 id="own-rules" className="px-4 pt-4 text-lg font-semibold">
          {t("ownTitle")}
        </h2>
        {own.length === 0 ? (
          <p className="px-4 py-3 text-text-2">{t("ownEmpty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {own.map((rule) => (
              <RuleRow key={rule.id} rule={rule} categories={categories} />
            ))}
          </ul>
        )}
        <NewRuleForm categories={categories} />
      </section>

      {system.length > 0 && (
        <section aria-labelledby="system-rules" className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
          <h2 id="system-rules" className="px-4 pt-4 text-lg font-semibold">
            {t("systemTitle")}
          </h2>
          <p className="px-4 pb-2 text-sm text-text-2">{t("systemHint")}</p>
          <ul className="divide-y divide-border border-t border-border">
            {system.map((rule) => (
              <li key={rule.id} className="flex items-center gap-3 px-4 py-3">
                <p className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{rule.matchKey}</span> <span className="text-text-2">{`→ ${categoryName(rule.categoryId)}`}</span>
                </p>
                <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-text-2">{t("suggestion")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
