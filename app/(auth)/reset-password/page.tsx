import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ResetForm } from "@/components/auth/reset-form";
import { createClient } from "@/utils/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.reset");
  return { title: t("title") };
}

export default async function ResetPasswordPage() {
  const t = await getTranslations("auth.reset");
  // csak érvényes (recovery) session-nel érhető el (§10.1); az identitást a szerver ellenőrzi
  const supabase = createClient(await cookies());
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/forgot-password?error=otp_expired");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <ResetForm />
    </div>
  );
}
