import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SubmitButton } from "@/components/auth/submit-button";
import { Notice } from "@/components/auth/notice";
import { first } from "@/lib/search-params";
import { confirmSchema, type OtpType } from "@/lib/schemas/auth";
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

// Közbenső oldal: a token CSAK a gombnyomásra kerül felhasználásra (e-mail-szkennerek ellen)
export default async function ConfirmPage(props: PageProps<"/auth/confirm">) {
  const t = await getTranslations("auth.confirm");
  const params = await props.searchParams;
  const parsed = confirmSchema.safeParse({
    token_hash: first(params.token_hash),
    type: first(params.type),
    next: first(params.next),
  });

  if (!parsed.success) {
    return (
      <div className="flex flex-col gap-4">
        <Notice variant="error">{t("invalid")}</Notice>
        <Link href="/login" className="flex min-h-11 items-center justify-center text-sm font-medium text-primary-text underline">
          {t("titleDefault")}
        </Link>
      </div>
    );
  }

  const { token_hash, type, next } = parsed.data;
  return (
    <form action={confirmOtp} className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t(TITLE_KEY[type])}</h1>
      <p className="text-text-2">{t("body")}</p>
      <input type="hidden" name="token_hash" value={token_hash} />
      <input type="hidden" name="type" value={type} />
      {next && <input type="hidden" name="next" value={next} />}
      <SubmitButton pendingLabel={t("pending")}>{t("continue")}</SubmitButton>
    </form>
  );
}
