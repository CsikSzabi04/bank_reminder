import { Landmark, PiggyBank, Wallet, type LucideIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { AccountKind, BankAccount } from "@/lib/bank/types";

const ICONS: Record<AccountKind, LucideIcon> = { current: Wallet, savings: PiggyBank, other: Landmark };

// A kapcsolat számlái. Három típussal számol (A-40): folyószámla · más pénznemű számla (ugyanaz az IBAN is lehet) ·
// megtakarítási számla IBAN nélkül. Az IBAN sosem feltétel; ha van, csak az utolsó 4 jegy látszik.
export async function AccountList({ accounts }: { accounts: BankAccount[] }) {
  const t = await getTranslations("bank");
  if (accounts.length === 0) return <p className="text-sm text-text-2">{t("connection.noAccounts")}</p>;

  return (
    <ul className="flex flex-col divide-y divide-border rounded-control border border-border">
      {accounts.map((account) => {
        const Icon = ICONS[account.kind];
        return (
          <li key={account.key} className="flex min-h-12 items-center gap-3 px-3 py-2">
            <Icon className="size-5 shrink-0 text-text-2" aria-hidden />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium">{account.name ?? t(`accounts.kind.${account.kind}`)}</span>
              <span className="truncate text-sm text-text-2">
                {account.name ? `${t(`accounts.kind.${account.kind}`)} · ` : ""}
                {account.currency}
                {account.ibanLast4 ? ` · ${t("accounts.ibanEnding", { last4: account.ibanLast4 })}` : ""}
              </span>
            </span>
            {account.syncEnabled !== null && (
              <span className="shrink-0 text-sm text-text-2">{t(account.syncEnabled ? "accounts.sync.on" : "accounts.sync.off")}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
