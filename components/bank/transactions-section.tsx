import { ArrowDownLeft, ArrowUpRight, Clock, Landmark, PiggyBank, ReceiptText, Receipt } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CategoryChip } from "@/components/categories/category-chip";
import { SyncNowButton } from "@/components/bank/sync-now-button";
import { TxActions } from "@/components/bank/tx-actions";
import { EmptyState } from "@/components/ui/empty-state";
import { getBankConnections } from "@/lib/bank/queries";
import { getTransactions, type TxLinks } from "@/lib/bank/transactions-queries";
import { accountOptions, parseTxFilters, TX_PAGE_SIZE, txOutcome, type BankTx, type TxFilters } from "@/lib/bank/transactions";
import { getRulesData } from "@/lib/bank/rules-queries";
import { formatAge, formatMoney, formatShortDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";

const CARD = "rounded-card border border-border bg-surface p-5 shadow-card";
const FIELD = "min-h-11 rounded-control border border-border bg-surface px-3";

// Az URL-paraméterek visszaírása (szűrők + lap); az üres/alap értékek kimaradnak
function href(filters: TxFilters, over: Partial<TxFilters> = {}): string {
  const f = { ...filters, ...over };
  const q = new URLSearchParams({ section: "transactions" });
  if (f.account) q.set("account", f.account);
  if (f.direction !== "all") q.set("direction", f.direction);
  if (f.month) q.set("month", f.month);
  if (f.q) q.set("q", f.q);
  if (f.page > 1) q.set("page", String(f.page));
  return `/bank?${q.toString()}`;
}

// Tranzakciók (advanced.md A-48 szerződés): a saját bank minden tétele — mit lett belőle (számla kifizetve / megtakarítás / kiadás +
// besorolás / jóváírás), szűrők, utolsó szinkron. Az oszlopok felsorolva; az új banki oszlopok nélkül (szinkron élesítése előtt)
// „még nem elérhető" állapot látszik.
export async function TransactionsSection({ params, timeZone }: { params: Record<string, string | string[] | undefined>; timeZone: string }) {
  const t = await getTranslations("bank");
  const locale = (await getLocale()) as Locale;
  const filters = parseTxFilters(params);
  const [data, connections] = await Promise.all([getTransactions(filters), getBankConnections()]);

  if (!data.available) {
    return <EmptyState icon={Landmark} title={t("tx.unavailable.title")} body={t("tx.unavailable.body")} />;
  }

  const now = new Date();
  const active = connections.filter((c) => c.status === "active");
  const lastSync = connections
    .filter((c) => c.lastSyncAt)
    .sort((a, b) => Date.parse(b.lastSyncAt ?? "") - Date.parse(a.lastSyncAt ?? ""))[0];
  const accounts = accountOptions(connections, (kind) => t(`accounts.kind.${kind}`));
  const accountLabel = new Map(accounts.map((a) => [a.ref, a.label]));
  const { categories } = await getRulesData(locale);
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const choices = categories.map((c) => ({ id: c.id, name: c.name }));
  const totalPages = Math.max(1, Math.ceil(data.total / TX_PAGE_SIZE));
  const filtered = Boolean(filters.account || filters.direction !== "all" || filters.month || filters.q);

  return (
    <div className="flex flex-col gap-4">
      <p>{t("tx.intro")}</p>

      <section aria-label={t("tx.title")} className={`${CARD} flex flex-col gap-3`}>
        <p aria-live="polite" className="text-sm text-text-2">
          {lastSync?.lastSyncAt
            ? t(lastSync.lastSyncOk === false ? "tx.lastSync.failed" : "tx.lastSync.ok", { when: formatAge(lastSync.lastSyncAt, now, locale) })
            : t("tx.lastSync.never")}
        </p>
        {active[0] && <SyncNowButton connectionId={active[0].id} timeZone={timeZone} />}
      </section>

      <form method="get" action="/bank" aria-label={t("tx.filters.label")} className={`${CARD} flex flex-col gap-3`}>
        <input type="hidden" name="section" value="transactions" />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("tx.filters.account")}
            <select name="account" defaultValue={filters.account ?? ""} className={FIELD}>
              <option value="">{t("tx.filters.accountAll")}</option>
              {accounts.map((a) => (
                <option key={a.ref} value={a.ref}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("tx.filters.direction")}
            <select name="direction" defaultValue={filters.direction} className={FIELD}>
              <option value="all">{t("tx.filters.directionAll")}</option>
              <option value="debit">{t("tx.filters.debit")}</option>
              <option value="credit">{t("tx.filters.credit")}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("tx.filters.month")}
            <input type="month" name="month" defaultValue={filters.month ?? ""} className={FIELD} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            {t("tx.filters.q")}
            <input type="search" name="q" defaultValue={filters.q ?? ""} maxLength={60} className={FIELD} aria-describedby="tx-q-hint" />
            <span id="tx-q-hint" className="text-sm font-normal text-text-2">
              {t("tx.filters.qHint")}
            </span>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="min-h-11 rounded-control bg-primary px-5 text-sm font-medium text-primary-fg">
            {t("tx.filters.apply")}
          </button>
          {filtered && (
            <Link href="/bank?section=transactions" className="inline-flex min-h-11 items-center rounded-control border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2">
              {t("tx.filters.clear")}
            </Link>
          )}
        </div>
      </form>

      {data.items.length === 0 ? (
        data.hasAny || filtered ? (
          <p className={`${CARD} text-text-2`}>{t("tx.emptyFiltered")}</p>
        ) : (
          <EmptyState icon={Receipt} title={t("tx.empty.title")} body={t("tx.empty.body")} />
        )
      ) : (
        <>
          <p className="text-sm text-text-2">{t("tx.count", { total: data.total })}</p>
          <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface shadow-card">
            {data.items.map((tx) => (
              <TxRow key={tx.id} tx={tx} locale={locale} accountLabel={accountLabel.get(tx.accountRef ?? "")} links={data.links} categoryById={categoryById} choices={choices} t={t} />
            ))}
          </ul>
          {totalPages > 1 && (
            <nav aria-label={t("tx.pager.label")} className="flex items-center justify-between gap-3">
              {filters.page > 1 ? (
                <Link href={href(filters, { page: filters.page - 1 })} rel="prev" className="inline-flex min-h-11 items-center rounded-control border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2">
                  {t("tx.pager.newer")}
                </Link>
              ) : (
                <span />
              )}
              <span className="text-sm text-text-2">{t("tx.pager.page", { page: filters.page })}</span>
              {filters.page < totalPages ? (
                <Link href={href(filters, { page: filters.page + 1 })} rel="next" className="inline-flex min-h-11 items-center rounded-control border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2">
                  {t("tx.pager.older")}
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}

type Translate = Awaited<ReturnType<typeof getTranslations<"bank">>>;

function TxRow({
  tx,
  locale,
  accountLabel,
  links,
  categoryById,
  choices,
  t,
}: {
  tx: BankTx;
  locale: Locale;
  accountLabel: string | undefined;
  links: TxLinks,
  categoryById: Map<string, { id: string; name: string; icon: string; colorSlot: number }>;
  choices: { id: string; name: string }[];
  t: Translate;
}) {
  const outcome = txOutcome(tx);
  const credit = tx.direction === "credit";
  const who = tx.who ?? t("tx.row.unknownWho");
  const sign = credit ? "+" : "−";
  const category = tx.categoryId ? categoryById.get(tx.categoryId) : undefined;

  let badge: { icon: typeof Clock; text: string; tone: string; href?: string };
  switch (outcome.kind) {
    case "credit":
      badge = { icon: ArrowDownLeft, text: t("tx.outcome.credit"), tone: "bg-success/15 text-success-text" };
      break;
    case "bill": {
      const bill = links.bills.get(outcome.occurrenceId);
      badge = { icon: ReceiptText, text: bill ? t("tx.outcome.bill", { name: bill.name }) : t("tx.outcome.billUnknown"), tone: "bg-primary-soft text-primary-text", href: bill ? `/reminders/${bill.reminderId}` : undefined };
      break;
    }
    case "saving": {
      const goal = links.savings.get(outcome.contributionId);
      badge = { icon: PiggyBank, text: goal ? t("tx.outcome.saving", { name: goal.name }) : t("tx.outcome.savingUnknown"), tone: "bg-primary-soft text-primary-text", href: goal ? `/savings/${goal.goalId}` : undefined };
      break;
    }
    case "expense":
      badge = outcome.categoryId
        ? { icon: ArrowUpRight, text: t("tx.outcome.expense"), tone: "bg-surface-2 text-text-2" }
        : { icon: Clock, text: t("tx.outcome.uncategorized"), tone: "bg-warning/20 text-warning-text" };
      break;
    case "dismissed":
      badge = { icon: ArrowUpRight, text: t("tx.outcome.dismissed"), tone: "bg-surface-2 text-text-2" };
      break;
    default:
      badge = { icon: Clock, text: t("tx.outcome.pending"), tone: "bg-surface-2 text-text-2" };
  }
  const Icon = badge.icon;

  return (
    <li className="flex flex-col gap-3 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{who}</p>
          <p className="text-sm text-text-2">
            {formatShortDate(tx.bookedOn, locale)}
            {accountLabel ? ` · ${t("tx.row.account", { name: accountLabel })}` : ""}
          </p>
          {tx.remittance && <p className="break-words text-sm text-text-2">{tx.remittance}</p>}
        </div>
        <p className={`shrink-0 font-semibold tabular-nums ${credit ? "text-success-text" : ""}`}>
          <span className="sr-only">{credit ? t("tx.row.credit") : t("tx.row.debit")}: </span>
          {`${sign}${formatMoney(tx.amount, tx.currency, locale)}`}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {badge.href ? (
          <Link href={badge.href} className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium hover:underline ${badge.tone}`}>
            <Icon className="size-4" aria-hidden />
            {badge.text}
          </Link>
        ) : (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${badge.tone}`}>
            <Icon className="size-4" aria-hidden />
            {badge.text}
          </span>
        )}
        {outcome.kind === "expense" && category && <CategoryChip category={category} />}
      </div>

      {outcome.kind === "expense" && (
        <TxActions id={tx.id} name={who} categorized={Boolean(outcome.categoryId)} hasMerchantKey={Boolean(tx.merchantKey)} categories={choices} />
      )}
    </li>
  );
}
