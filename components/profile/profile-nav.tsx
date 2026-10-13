import { ChevronRight, Palette, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";

export const PROFILE_SECTIONS = ["overview", "appearance", "security"] as const;
export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

const ICONS: Record<ProfileSection, LucideIcon> = { overview: UserRound, appearance: Palette, security: ShieldCheck };

export const isProfileSection = (value: string | undefined): value is ProfileSection =>
  (PROFILE_SECTIONS as readonly string[]).includes(value ?? "");

// Szakasz-lista: az aktív szakasz az URL-ben él (`?section=…`), így megosztható és frissítés-biztos (§19.1)
export async function ProfileNav({ current, className }: { current: ProfileSection; className?: string }) {
  const t = await getTranslations("profile.sections");
  return (
    <nav aria-label={t("label")} className={className}>
      <ul className="flex flex-col gap-1">
        {PROFILE_SECTIONS.map((section) => {
          const Icon = ICONS[section];
          const active = section === current;
          return (
            <li key={section}>
              <Link
                href={`/profile?section=${section}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-control px-3 text-base font-medium",
                  active ? "bg-primary-soft text-primary-text" : "text-text hover:bg-surface-2",
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span className="flex-1">{t(section)}</span>
                <ChevronRight className="size-4 text-text-muted md:hidden" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
