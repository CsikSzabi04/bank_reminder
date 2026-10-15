"use client";

import { CircleCheck, KeyRound, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { CopyField } from "@/components/bank/copy-field";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { MAX_ALLOWED_APPS, normalizeApps, type IngestToken } from "@/lib/bank/ingest";
import { createIngestToken, regenerateIngestToken, revokeIngestToken, saveIngestApps } from "@/lib/bank/ingest-actions";
import type { IngestError } from "@/lib/bank/ingest-service";
import { formatDate, formatTime } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";

const BTN =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2 disabled:opacity-60";
const FIELD = "min-h-11 rounded-control border border-border bg-surface px-3";

type Revealed = { id: string; token: string; oldRevoked: boolean };

const errorOf = (res: { ok: boolean; reason?: string }): IngestError => ((res.ok ? "failed" : (res.reason as IngestError | undefined)) ?? "failed");

// Engedélyezett appok szerkesztője (tokenenként): csomagnév-chipek, hozzáadás (érvényesítve), a „legutóbb érkezett" appok koppintással
function AppsEditor({ token, suggestions }: { token: IngestToken; suggestions: string[] }) {
  const t = useTranslations("bank.android");
  const router = useRouter();
  const toast = useToast();
  const inputId = useId();
  const [apps, setApps] = useState(token.allowedApps);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<IngestError | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = apps.join("\n") !== token.allowedApps.join("\n");
  const offered = suggestions.filter((s) => !apps.includes(s));

  const add = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    const next = normalizeApps([...apps, value]);
    if (!next.ok) return setError(next.reason === "tooMany" ? "too_many_apps" : next.reason === "tooLong" ? "apps_too_long" : "invalid_apps");
    setApps(next.apps);
    setDraft("");
    setError(null);
  };

  const save = () =>
    startTransition(async () => {
      setError(null);
      const res = await saveIngestApps({ id: token.id, apps });
      if (res.ok) {
        toast.show({ message: t("apps.saved"), tone: "success" });
        router.refresh();
        return;
      }
      setError(errorOf(res));
    });

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h4 className="font-semibold">{t("apps.title")}</h4>
        <p className="text-sm text-text-2">{t("apps.hint")}</p>
      </div>
      {apps.length === 0 ? (
        <p className="text-sm text-text-2">{t("apps.none")}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {apps.map((app) => (
            <li key={app} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 py-1 pr-1 pl-3 text-sm">
              <span className="break-all">{app}</span>
              <button
                type="button"
                onClick={() => setApps(apps.filter((a) => a !== app))}
                aria-label={t("apps.remove", { app })}
                className="flex size-8 items-center justify-center rounded-full hover:bg-surface"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor={inputId} className="text-sm font-medium">
          {t("apps.label")}
        </label>
        <div className="flex gap-2">
          <input
            id={inputId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(draft);
              }
            }}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={apps.length >= MAX_ALLOWED_APPS}
            className={`${FIELD} min-w-0 flex-1`}
          />
          <button type="button" onClick={() => add(draft)} disabled={!draft.trim()} className={BTN}>
            <Plus className="size-4" aria-hidden />
            {t("apps.add")}
          </button>
        </div>
      </div>
      {offered.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-text-2">{t("apps.suggestions")}</p>
          <ul className="flex flex-wrap gap-2">
            {offered.map((app) => (
              <li key={app}>
                <button type="button" onClick={() => add(app)} aria-label={t("apps.addSuggestion", { app })} className="inline-flex min-h-11 items-center gap-1 rounded-full border border-dashed border-border px-3 text-sm hover:bg-surface-2">
                  <Plus className="size-3" aria-hidden />
                  <span className="break-all">{app}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger-text">
          {t(`error.${error}`)}
        </p>
      )}
      <div>
        <button type="button" onClick={save} disabled={!dirty || pending} className="min-h-11 rounded-control bg-primary px-5 text-sm font-medium text-primary-fg disabled:opacity-60">
          {t("apps.save")}
        </button>
      </div>
    </div>
  );
}

function TokenRow({ token, suggestions, timeZone, onRevealed }: { token: IngestToken; suggestions: string[]; timeZone: string; onRevealed: (r: Revealed) => void }) {
  const t = useTranslations("bank.android");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const toast = useToast();
  const [confirm, setConfirm] = useState<"revoke" | "regenerate" | null>(null);
  const when = (iso: string) => `${formatDate(iso, locale, timeZone)} ${formatTime(iso, locale, timeZone)}`;
  const active = token.revokedAt === null;

  return (
    <li className="flex flex-col gap-3 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium">
            <KeyRound className="size-4 text-text-2" aria-hidden />
            <span className="truncate">{token.label ?? t("token.unnamed")}</span>
            <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">{`${token.prefix}…`}</code>
          </p>
          <p className="text-sm text-text-2">
            {token.lastUsedAt ? t("token.lastUsed", { when: when(token.lastUsedAt) }) : t("token.neverUsed")} · {t("token.created", { when: formatDate(token.createdAt, locale, timeZone) })}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${active ? "bg-success/15 text-success-text" : "bg-surface-2 text-text-2"}`}
        >
          {active ? <CircleCheck className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
          {active ? t("token.active") : t("token.revoked")}
        </span>
      </div>

      {active && (
        <>
          <AppsEditor token={token} suggestions={suggestions} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setConfirm("regenerate")} className={BTN}>
              {t("token.regenerate")}
            </button>
            <button type="button" onClick={() => setConfirm("revoke")} className={`${BTN} text-danger-text`}>
              {t("token.revoke")}
            </button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirm === "revoke"}
        onClose={() => setConfirm(null)}
        title={t("token.revokeTitle")}
        description={t("token.revokeBody")}
        confirmLabel={t("token.revokeConfirm")}
        destructive
        onConfirm={async () => {
          const res = await revokeIngestToken(token.id);
          if (!res.ok) throw new Error("revoke_failed");
          toast.show({ message: t("token.revokedToast"), tone: "success" });
          router.refresh();
        }}
      />
      <ConfirmDialog
        open={confirm === "regenerate"}
        onClose={() => setConfirm(null)}
        title={t("token.regenerateTitle")}
        description={t("token.regenerateBody")}
        confirmLabel={t("token.regenerateConfirm")}
        onConfirm={async () => {
          const res = await regenerateIngestToken(token.id);
          if (!res.ok || !res.data) throw new Error("regenerate_failed");
          onRevealed({ id: res.data.id, token: res.data.token, oldRevoked: res.data.oldRevoked });
          router.refresh();
        }}
      />
    </li>
  );
}

// Webhook-token kezelés: létrehozás (a nyers token EGYSZER látszik, csak a komponens állapotában él — újratöltés után nincs meg),
// lista, visszavonás/újragenerálás megerősítéssel, tokenenkénti engedélyezett appok
export function IngestPanel({ tokens, suggestions, timeZone }: { tokens: IngestToken[]; suggestions: string[]; timeZone: string }) {
  const t = useTranslations("bank.android");
  const router = useRouter();
  const toast = useToast();
  const labelId = useId();
  const [label, setLabel] = useState("");
  const [error, setError] = useState<IngestError | null>(null);
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [pending, startTransition] = useTransition();

  const create = () =>
    startTransition(async () => {
      setError(null);
      const res = await createIngestToken({ label, apps: [] });
      if (res.ok && res.data) {
        setRevealed({ id: res.data.id, token: res.data.token, oldRevoked: true });
        setLabel("");
        toast.show({ message: t("token.createdToast"), tone: "success" });
        router.refresh();
        return;
      }
      setError(errorOf(res));
    });

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="ingest-token-title" className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-card">
        <div>
          <h3 id="ingest-token-title" className="text-lg font-semibold">
            {t("token.title")}
          </h3>
          <p className="text-sm text-text-2">{t("token.lead")}</p>
        </div>

        {revealed && (
          <div role="status" className="flex flex-col gap-3 rounded-control border border-warning/50 bg-warning/10 p-4">
            <p className="font-semibold">{t("token.revealTitle")}</p>
            <CopyField label={t("token.title")} value={revealed.token} />
            <p className="text-sm">{t("token.revealWarning")}</p>
            <p className="text-sm">{t("token.revealNext")}</p>
            {!revealed.oldRevoked && <p className="text-sm font-medium text-danger-text">{t("token.oldNotRevoked")}</p>}
            <div>
              <button type="button" onClick={() => setRevealed(null)} className={BTN}>
                {t("token.hide")}
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor={labelId} className="text-sm font-medium">
            {t("token.labelLabel")}
          </label>
          <input id={labelId} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} className={FIELD} aria-describedby={`${labelId}-hint`} />
          <p id={`${labelId}-hint`} className="text-sm text-text-2">
            {t("token.labelHint")}
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger-text">
            {t(`error.${error}`)}
          </p>
        )}
        <div>
          <button type="button" onClick={create} disabled={pending} aria-busy={pending} className="min-h-12 rounded-control bg-primary px-5 font-medium text-primary-fg disabled:opacity-60">
            {pending ? t("token.creating") : t("token.create")}
          </button>
        </div>
      </section>

      <section aria-labelledby="ingest-list-title" className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
        <h3 id="ingest-list-title" className="px-4 pt-4 text-lg font-semibold">
          {t("token.list")}
        </h3>
        {tokens.length === 0 ? (
          <p className="px-4 py-3 text-text-2">{t("token.none")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {tokens.map((token) => (
              <TokenRow key={token.id} token={token} suggestions={suggestions} timeZone={timeZone} onRevealed={setRevealed} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
