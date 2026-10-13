import type { Metadata } from "next";
import { PiggyBank, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ContributionSheet } from "@/components/savings/contribution-sheet";
import { GoalCard } from "@/components/savings/goal-card";
import { EmptyState } from "@/components/ui/empty-state";
import { todayIn } from "@/lib/format";
import { getCurrentProfile } from "@/lib/profile/queries";
import { PRESETS } from "@/lib/savings/icons";
import { getGoals } from "@/lib/savings/queries";
import { first } from "@/lib/search-params";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("savings");
  return { title: t("title") };
}

const BTN = "inline-flex min-h-11 items-center gap-2 rounded-control bg-primary px-4 text-sm font-medium text-primary-fg";
const TAB = "flex min-h-11 items-center rounded-full border px-4 text-sm font-medium";

export default async function SavingsPage(props: PageProps<"/savings">) {
  const t = await getTranslations("savings");
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=%2Fsavings");

  const archived = first((await props.searchParams).archived) === "1";
  const goals = await getGoals(archived);
  const today = todayIn(profile.timezone);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <Link href="/savings/new" className={BTN}>
          <Plus className="size-4" aria-hidden />
          {t("newGoal")}
        </Link>
      </div>

      <nav aria-label={t("title")} className="flex gap-2">
        <Link href="/savings" aria-current={archived ? undefined : "page"} className={cn(TAB, archived ? "border-border bg-surface text-text-2" : "border-primary bg-primary-soft text-primary-text")}>
          {t("active")}
        </Link>
        <Link href="/savings?archived=1" aria-current={archived ? "page" : undefined} className={cn(TAB, archived ? "border-primary bg-primary-soft text-primary-text" : "border-border bg-surface text-text-2")}>
          {t("archivedTab")}
        </Link>
      </nav>

      {goals.length === 0 ? (
        archived ? (
          <p className="text-text-2">{t("noArchived")}</p>
        ) : (
          <EmptyState icon={PiggyBank} title={t("empty.title")} body={t("empty.body")}>
            <ul className="flex flex-wrap justify-center gap-2">
              {PRESETS.map((p) => (
                <li key={p}>
                  <Link href={`/savings/new?preset=${p}`} className="flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2">
                    {t(`presets.${p}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </EmptyState>
        )
      ) : (
        <ul className="flex flex-col gap-4">
          {goals.map((g) => (
            <li key={g.id}>
              <GoalCard goal={g} href={`/savings/${g.id}`}>
                {!archived && (
                  <div className="flex flex-wrap gap-2">
                    <ContributionSheet goalId={g.id} goalName={g.name} mode="add" today={today} />
                    <ContributionSheet goalId={g.id} goalName={g.name} mode="withdraw" today={today} />
                  </div>
                )}
              </GoalCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
