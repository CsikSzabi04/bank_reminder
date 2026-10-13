import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthTabs } from "@/components/auth/auth-tabs";
import { LoginForm } from "@/components/auth/login-form";
import { safeNext } from "@/lib/auth/safe-next";
import { first } from "@/lib/search-params";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.login");
  return { title: t("submit") };
}

export default async function LoginPage(props: PageProps<"/login">) {
  const t = await getTranslations("auth.login");
  const params = await props.searchParams;
  const next = first(params.next);
  // csak érvényes, saját útvonal kerül az űrlapba (open redirect ellen, §10.7)
  const safe = next ? safeNext(next, "") : "";

  return (
    <>
      <AuthTabs />
      <h1 className="mb-4 text-2xl font-semibold">{t("title")}</h1>
      <LoginForm next={safe || undefined} linkExpired={first(params.error) === "linkExpired"} />
    </>
  );
}
