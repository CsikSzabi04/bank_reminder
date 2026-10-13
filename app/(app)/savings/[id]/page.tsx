import type { Metadata } from "next";
import { ChevronLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { ContributionSheet } from "@/components/savings/contribution-sheet";
import { GoalCard } from "@/components/savings/goal-card";
import { ArchiveButton, ContributionList } from "@/components/savings/goal-actions";
import { todayIn } from "@/lib/format";
import { getCurrentProfile } from "@/lib/profile/queries";
import { getContributions, getGoal } from "@/lib/savings/queries";

export async function generateMetadata(props: PageProps<"/savings/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const goal = z.uuid().safeParse(id).success ? await getGoal(id) : null;
  return goal ? { title: goal.name } : {};
}

export default async function GoalPage(props: PageProps<"/savings/[id]">) {
  const t = await getTranslations("savings");
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();
  const profile = await getCurrentProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent(`/savings/${id}`)}`);

  const [goal, contributions] = await Promise.all([getGoal(id), getContributions(id)]);
  if (!goal) notFound();
  const today = todayIn(profile.timezone);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <Link href="/savings" className="flex min-h-11 w-fit items-center gap-1 text-sm font-medium text-primary-text">
        <ChevronLeft className="size-4" aria-hidden />
        {t("back")}
      </Link>
      <h1 className="sr-only">{goal.name}</h1>
      <GoalCard goal={goal}>
        <div className="flex flex-wrap gap-2">
          {!goal.archived && (
            <>
              <ContributionSheet goalId={goal.id} goalName={goal.name} mode="add" today={today} />
              <ContributionSheet goalId={goal.id} goalName={goal.name} mode="withdraw" today={today} />
            </>
          )}
          <Link
            href={`/savings/${goal.id}/edit`}
            className="inline-flex min-h-11 items-center gap-2 rounded-control border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2"
          >
            <Pencil className="size-4" aria-hidden />
            {t("edit")}
          </Link>
          <ArchiveButton goalId={goal.id} archived={goal.archived} />
        </div>
      </GoalCard>

      <section aria-labelledby="history-title" className="flex flex-col gap-2">
        <h2 id="history-title" className="text-lg font-semibold">
          {t("history")}
        </h2>
        {contributions.length === 0 ? <p className="text-text-2">{t("noHistory")}</p> : <ContributionList items={contributions} currency={goal.currency} />}
      </section>
    </div>
  );
}
