import { LogOut, MonitorSmartphone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { signOut } from "@/lib/auth/sign-out";
import { EmailForm } from "./email-form";
import { PasswordForm } from "./password-form";

const BUTTON =
  "inline-flex min-h-11 items-center gap-2 rounded-control border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2";

// Biztonság (§19.1): jelszó- és e-mail-módosítás, kijelentkezés (ezen az eszközön / mindenhonnan)
export async function SecuritySection({ email }: { email: string }) {
  const t = await getTranslations("profile.security");
  return (
    <section className="flex flex-col gap-6 rounded-card border border-border bg-surface p-5 shadow-card">
      <h2 className="text-lg font-semibold">{t("title")}</h2>

      <PasswordForm />
      <EmailForm current={email} />

      <form action={signOut} className="flex flex-col items-start gap-2 border-t border-border pt-5">
        <button type="submit" className={BUTTON}>
          <LogOut className="size-4" aria-hidden />
          {t("signOut")}
        </button>
        <p className="text-sm text-text-2">{t("signOutHint")}</p>
      </form>

      <form action={signOut} className="flex flex-col items-start gap-2 border-t border-border pt-5">
        <input type="hidden" name="scope" value="global" />
        <button type="submit" className={BUTTON}>
          <MonitorSmartphone className="size-4" aria-hidden />
          {t("signOutAll")}
        </button>
        <p className="text-sm text-text-2">{t("signOutAllHint")}</p>
      </form>
    </section>
  );
}
