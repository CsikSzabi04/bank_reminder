import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthTabs } from "@/components/auth/auth-tabs";
import { SignupForm } from "@/components/auth/signup-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signup");
  return { title: t("submit") };
}

export default async function SignupPage() {
  const t = await getTranslations("auth.signup");
  return (
    <>
      <AuthTabs />
      <h1 className="mb-4 text-2xl font-semibold">{t("title")}</h1>
      <SignupForm />
    </>
  );
}
