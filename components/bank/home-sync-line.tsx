import { Landmark } from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { getBankAccess, getBankConnections } from "@/lib/bank/queries";
import { sinceHours } from "@/lib/bank/transactions";
import { formatAge } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createClient } from "@/utils/supabase/server";

// Főoldal: „Bank: utolsó szinkron …, N új tétel" (A-48 kérés) — egy sor, a Tranzakciók szakaszra mutat.
// Csak bank-jogosultnak, és csak ha volt már szinkron; nem kritikus elem: hiba esetén nem jelenik meg.
export async function HomeSyncLine() {
  let lastSyncAt: string | null = null;
  let fresh = 0;
  try {
    if (!(await getBankAccess()).syncAllowed) return null;
    const connections = await getBankConnections();
    lastSyncAt = connections.map((c) => c.lastSyncAt).filter((v): v is string => Boolean(v)).sort().at(-1) ?? null;
    if (!lastSyncAt) return null;
    const supabase = createClient(await cookies());
    const since = sinceHours(24);
    const { count } = await supabase.from("bank_transactions").select("id", { count: "exact", head: true }).gte("created_at", since);
    fresh = count ?? 0;
  } catch {
    return null;
  }
  const t = await getTranslations("bank");
  const locale = (await getLocale()) as Locale;
  return (
    <Link
      href="/bank?section=transactions"
      className="flex min-h-11 items-center gap-3 rounded-card border border-border bg-surface px-4 py-2 text-sm hover:bg-surface-2"
    >
      <Landmark className="size-5 shrink-0 text-text-2" aria-hidden />
      <span>{t("homeSync", { when: formatAge(lastSyncAt, new Date(), locale), count: fresh })}</span>
    </Link>
  );
}
