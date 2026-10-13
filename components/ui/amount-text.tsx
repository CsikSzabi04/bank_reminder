import { useLocale } from "next-intl";
import { formatMoney } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

// Pénz megjelenítése (H9: csak formázunk, nem számolunk). Tabular számjegyek a listákban, nem törik sorba.
export function AmountText({
  amount,
  currency,
  hero = false,
  className,
}: {
  amount: number;
  currency: string;
  /** nagy szám (dashboard hero): arányos számjegyek */
  hero?: boolean;
  className?: string;
}) {
  const locale = useLocale() as Locale;
  return (
    <span className={cn("whitespace-nowrap", hero ? "text-[40px] leading-[1.1] font-semibold" : "tabular-nums", className)}>
      {formatMoney(amount, currency, locale)}
    </span>
  );
}
