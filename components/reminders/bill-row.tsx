import { BellOff } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { CategoryIcon } from "@/components/categories/category-icon";
import { AmountText } from "@/components/ui/amount-text";
import type { CategoryView } from "@/lib/category-icons";
import { cn } from "@/lib/utils";
import { DueLabel } from "./due-label";

export type BillRowProps = {
  /** a részletoldal; nélküle a sor nem kattintható */
  href?: string;
  name: string;
  amount: number;
  currency: string;
  dueDate: string;
  /** a mai nap a PROFIL időzónájában ("YYYY-MM-DD") */
  today: string;
  status: string;
  category?: CategoryView | null;
  /** pl. "havonta · 10. napján" */
  subtitle?: ReactNode;
  demo?: boolean;
  notifyOff?: boolean;
  /** jobb oldali művelet (PayButton) */
  action?: ReactNode;
};

// Egy esedékesség/emlékeztető sora (ref-3 „Bills list"): ikon · név+alcím · összeg+esedékesség · művelet.
// Prezentációs, props-ból dolgozik → a /dev/ui játszótéren fixture-rel kipróbálható.
export function BillRow({
  href,
  name,
  amount,
  currency,
  dueDate,
  today,
  status,
  category,
  subtitle,
  demo,
  notifyOff,
  action,
}: BillRowProps) {
  const t = useTranslations("reminders");
  const main = (
    <>
      <CategoryIcon icon={category?.icon} colorSlot={category?.colorSlot} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className={cn("truncate font-medium", status === "skipped" && "text-text-2 line-through")}>{name}</span>
          {demo && (
            <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary-text">
              {t("demoBadge")}
            </span>
          )}
          {notifyOff && <BellOff aria-label={t("notifyOff")} role="img" className="size-3.5 shrink-0 text-text-muted" />}
        </span>
        {subtitle && <span className="block truncate text-sm text-text-2">{subtitle}</span>}
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <AmountText amount={amount} currency={currency} className="font-medium" />
        <DueLabel status={status} dueDate={dueDate} today={today} />
      </span>
    </>
  );

  return (
    <li className="flex items-center gap-2 px-4 py-3">
      {href ? (
        <Link href={href} className="-mx-2 flex min-w-0 flex-1 items-center gap-3 rounded-control px-2 py-1 hover:bg-surface-2">
          {main}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{main}</div>
      )}
      {action}
    </li>
  );
}

// A sorok kártyába csoportosítva (vékony elválasztókkal)
export function BillList({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ul aria-label={label} className="divide-y divide-border rounded-card border border-border bg-surface shadow-card">
      {children}
    </ul>
  );
}
