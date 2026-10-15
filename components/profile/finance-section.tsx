import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/utils/supabase/server";
import { CategoriesManager, type CustomCategory } from "./categories-manager";
import { FinanceForm } from "./finance-form";

const CARD = "flex flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-card";

// Profil → Pénzügyek (§19.1)
export async function FinanceSection({ userId }: { userId: string }) {
  const t = await getTranslations("profile.finance");
  const supabase = createClient(await cookies());
  const [profile, categories] = await Promise.all([
    supabase.from("profiles").select("base_currency, timezone, monthly_income").eq("id", userId).single(),
    // csak a saját kategóriák (a rendszer-kategóriának van `key`-je)
    supabase.from("categories").select("id, name_hu, name_en, icon, color_slot, kind").is("key", null).order("created_at"),
  ]);
  if (!profile.data) return null;
  const items: CustomCategory[] = (categories.data ?? []).map((c) => ({
    id: c.id,
    nameHu: c.name_hu ?? "",
    nameEn: c.name_en ?? "",
    icon: c.icon,
    colorSlot: c.color_slot,
    kind: c.kind === "bill" || c.kind === "expense" ? c.kind : "both",
  }));

  return (
    <div className="flex flex-col gap-4">
      <section className={CARD} aria-labelledby="fin-title">
        <h2 id="fin-title" className="text-lg font-semibold">
          {t("title")}
        </h2>
        <FinanceForm currency={profile.data.base_currency} timezone={profile.data.timezone} income={profile.data.monthly_income === null ? "" : String(profile.data.monthly_income)} />
      </section>
      <section className={CARD} aria-labelledby="cat-title">
        <h2 id="cat-title" className="text-lg font-semibold">
          {t("categories.title")}
        </h2>
        <p className="text-sm text-text-2">{t("categories.hint")}</p>
        <CategoriesManager items={items} />
      </section>
    </div>
  );
}
