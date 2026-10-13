import { LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { signOut } from "@/lib/auth/sign-out";

// Kijelentkezés (ezen az eszközön). Szerver-action űrlap: JS nélkül is működik.
export async function SignOutButton({ className }: { className?: string }) {
  const t = await getTranslations("nav");
  return (
    <form action={signOut}>
      <button type="submit" className={className}>
        <LogOut className="size-5" aria-hidden />
        <span className="truncate">{t("signOut")}</span>
      </button>
    </form>
  );
}
