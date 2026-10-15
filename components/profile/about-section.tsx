import { Mail } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BRAND } from "@/lib/brand";

const CARD = "flex flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-card";
const LINK = "inline-flex min-h-11 items-center rounded-control px-1 text-sm font-medium text-primary-text hover:underline";

// Profil → Névjegy (§19.1): verzió · jogi linkek · „nem bank" szöveg · visszajelzés (mailto; a cím a környezetből jön, nincs beégetve)
export async function AboutSection() {
  const t = await getTranslations("profile.about");
  const tc = await getTranslations("common");
  const feedback = process.env.NEXT_PUBLIC_FEEDBACK_EMAIL;
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "";

  return (
    <section className={CARD} aria-labelledby="about-title">
      <h2 id="about-title" className="text-lg font-semibold">
        {BRAND.name}
      </h2>
      {version && (
        <p className="text-sm text-text-2">
          {t("version")}: <span className="font-medium text-text tabular-nums">{version}</span>
        </p>
      )}
      <p>{tc("disclaimer.notBank")}</p>
      <ul className="flex flex-wrap gap-x-5">
        <li>
          <Link href="/privacy" className={LINK}>
            {t("privacy")}
          </Link>
        </li>
        <li>
          <Link href="/terms" className={LINK}>
            {t("terms")}
          </Link>
        </li>
        <li>
          <Link href="/install" className={LINK}>
            {t("install")}
          </Link>
        </li>
      </ul>
      {feedback && (
        <a
          href={`mailto:${feedback}?subject=${encodeURIComponent(`${BRAND.name} — ${t("feedbackSubject")}`)}`}
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-control border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2"
        >
          <Mail className="size-4" aria-hidden />
          {t("feedback")}
        </a>
      )}
    </section>
  );
}
