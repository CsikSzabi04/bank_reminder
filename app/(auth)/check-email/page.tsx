import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Notice } from "@/components/auth/notice";
import { ResendForm } from "@/components/auth/resend-form";
import { first } from "@/lib/search-params";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.checkEmail");
  return { title: t("title") };
}

export default async function CheckEmailPage(props: PageProps<"/check-email">) {
  const t = await getTranslations("auth");
  const params = await props.searchParams;
  const email = first(params.e);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("checkEmail.title")}</h1>
      {first(params.error) === "otp_expired" ? (
        <Notice variant="error">{t("checkEmail.expired")}</Notice>
      ) : (
        // általános szöveg: nem árulja el, hogy az e-mail már regisztrált-e
        <p className="text-text-2">{t("checkEmail.body")}</p>
      )}
      <ResendForm email={email} />
      <Link href="/login" className="flex min-h-11 items-center justify-center text-sm font-medium text-primary-text underline">
        {t("checkEmail.backToLogin")}
      </Link>
    </div>
  );
}
