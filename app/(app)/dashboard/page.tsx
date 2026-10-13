import { getTranslations } from "next-intl/server";

// Ideiglenes: a valódi főoldal a B-14 feladat
export default async function DashboardPage() {
  const t = await getTranslations("nav");
  return <h1 className="text-2xl font-semibold">{t("home")}</h1>;
}
