import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { GoalForm } from "@/components/savings/goal-form";
import { todayIn } from "@/lib/format";
import { getCurrentProfile } from "@/lib/profile/queries";
import { getGoal } from "@/lib/savings/queries";
import { addDays } from "@/lib/tz";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("savings");
  return { title: t("edit") };
}

export default async function EditGoalPage(props: PageProps<"/savings/[id]/edit">) {
  const t = await getTranslations("savings");
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();
  const profile = await getCurrentProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent(`/savings/${id}/edit`)}`);
  const goal = await getGoal(id);
  if (!goal) notFound();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <Link href={`/savings/${id}`} className="flex min-h-11 w-fit items-center gap-1 text-sm font-medium text-primary-text">
        <ChevronLeft className="size-4" aria-hidden />
        {t("back")}
      </Link>
      <h1 className="text-2xl font-semibold">{t("edit")}</h1>
      <div className="rounded-card border border-border bg-surface p-5 shadow-card">
        <GoalForm
          goalId={id}
          minDate={addDays(todayIn(profile.timezone), 1)}
          initial={{ name: goal.name, target: String(goal.target), targetDate: goal.targetDate ?? "", icon: goal.icon, colorSlot: goal.colorSlot }}
        />
      </div>
    </div>
  );
}
