import { SearchX } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/empty-state";

// Saját 404: barátságos szöveg + vissza a főoldalra (§14.12)
export async function NotFoundView() {
  const t = await getTranslations("errors.notFound");
  return (
    <div className="mx-auto max-w-lg py-10">
      <EmptyState icon={SearchX} title={t("title")} body={t("body")}>
        <Link href="/dashboard" className="inline-flex min-h-11 items-center rounded-control bg-primary px-5 text-sm font-medium text-primary-fg">
          {t("home")}
        </Link>
      </EmptyState>
    </div>
  );
}
