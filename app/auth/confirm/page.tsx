import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Notice } from "@/components/auth/notice";
import { SubmitButton } from "@/components/auth/submit-button";
import { safeNext } from "@/lib/auth/safe-next";
import { confirmSchema, type OtpType } from "@/lib/schemas/auth";
import { first } from "@/lib/search-params";
import { confirmOtp } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.confirm");
  return { title: t("titleDefault") };
}

const TITLE_KEY = {
  signup: "titleSignup",
  invite: "titleSignup",
  recovery: "titleRecovery",
  email_change: "titleEmailChange",
  magiclink: "titleDefault",
  email: "titleDefault",
} as const satisfies Record<OtpType, string>;

const LINK = "flex min-h-11 items-center justify-center text-sm font-medium text-primary-text underline";

// Közbenső oldal: a token CSAK a gombnyomásra kerül felhasználásra (e-mail-szkennerek ellen).
// Három bejövő forma: token_hash (saját sablon), code (a Supabase alap sablonja, PKCE), error (lejárt/érvénytelen link).
export default async function ConfirmPage(props: PageProps<"/auth/confirm">) {
  const t = await getTranslations("auth");
  const params = await props.searchParams;
  const tokenHash = first(params.token_hash);

  // Alap Supabase-sablon: `?code=…` → a PKCE-csere a meglévő callback-útvonalon történik
  const code = first(params.code);
  if (code && !tokenHash) {
    redirect(`/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(safeNext(first(params.next)))}`);
  }

  // A Supabase a hibát query-ben adja: ?error=access_denied&error_code=otp_expired&error_description=…
  const errorCode = first(params.error_code) ?? first(params.error);
  if (errorCode && !tokenHash) {
    const expired = errorCode === "otp_expired" || errorCode === "access_denied";
    return (
      <div className="flex flex-col gap-4">
        <Notice variant="error">{expired ? t("error.linkExpired") : t("confirm.errorGeneric")}</Notice>
        <Link href="/check-email?type=signup&error=otp_expired" className={LINK}>
          {t("confirm.newLink")}
        </Link>
        <Link href="/login" className={LINK}>
          {t("checkEmail.backToLogin")}
        </Link>
      </div>
    );
  }

  const parsed = confirmSchema.safeParse({
    token_hash: tokenHash,
    type: first(params.type),
    next: first(params.next),
  });

  if (!parsed.success) {
    return (
      <div className="flex flex-col gap-4">
        <Notice variant="error">{t("confirm.invalid")}</Notice>
        <Link href="/login" className={LINK}>
          {t("checkEmail.backToLogin")}
        </Link>
      </div>
    );
  }

  const { token_hash, type, next } = parsed.data;
  return (
    <form action={confirmOtp} className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t(`confirm.${TITLE_KEY[type]}`)}</h1>
      <p className="text-text-2">{t("confirm.body")}</p>
      <input type="hidden" name="token_hash" value={token_hash} />
      <input type="hidden" name="type" value={type} />
      {next && <input type="hidden" name="next" value={next} />}
      <SubmitButton pendingLabel={t("confirm.pending")}>{t("confirm.continue")}</SubmitButton>
    </form>
  );
}
