import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ForgotForm } from "@/components/auth/forgot-form";
import { first } from "@/lib/search-params";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.forgot");
  return { title: t("title") };
}

export default async function ForgotPasswordPage(props: PageProps<"/forgot-password">) {
  const t = await getTranslations("auth.forgot");
  const params = await props.searchParams;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-text-2">{t("body")}</p>
      <ForgotForm linkExpired={first(params.error) === "otp_expired"} />
      <Link href="/login" className="flex min-h-11 items-center justify-center text-sm font-medium text-primary-text underline">
        {t("back")}
      </Link>
    </div>
  );
}
