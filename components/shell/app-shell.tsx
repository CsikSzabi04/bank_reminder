import { Bell, Download, User } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { Avatar } from "@/components/profile/avatar";
import { BRAND } from "@/lib/brand";
import { Fab } from "./fab";
import { MoreSheet } from "./more-sheet";
import { SignOutButton } from "./sign-out-button";
import { NavLink } from "./nav-link";
import { BOTTOM_NAV, SIDE_NAV } from "./nav-items";

const ICON_BTN =
  "flex size-11 items-center justify-center rounded-full text-text-2 hover:bg-surface-2";

// Reszponzív váz (§14.3): <768 alsó fül-sáv · 768–1023 ikon-sín · ≥1024 oldalsáv (248 px)
export type ShellUser = { id: string; name: string | null; avatarUrl: string | null };

export async function AppShell({ children, user, unread = 0 }: { children: ReactNode; user?: ShellUser; unread?: number }) {
  const t = await getTranslations();
  const avatarAlt = t("profile.overview.avatar.alt", { name: user?.name ?? "" });

  return (
    <div className="min-h-dvh md:flex">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-surface focus:px-4 focus:py-2 focus:shadow-card"
      >
        {t("nav.skipToContent")}
      </a>

      {/* Ikon-sín (tablet) */}
      <nav
        aria-label={t("nav.primary")}
        className="sticky top-0 hidden h-dvh w-16 shrink-0 flex-col items-center gap-1 border-r border-border bg-surface py-4 md:flex lg:hidden"
      >
        <Link href="/dashboard" aria-label={BRAND.name} className="mb-3 flex size-11 items-center justify-center text-primary">
          <Bell className="size-6" aria-hidden />
        </Link>
        {SIDE_NAV.map((item) => (
          <NavLink key={item.key} navKey={item.key} variant="rail" />
        ))}
      </nav>

      {/* Oldalsáv (asztal) */}
      <aside className="sticky top-0 hidden h-dvh w-62 shrink-0 flex-col border-r border-border bg-surface p-4 lg:flex">
        <Link href="/dashboard" className="mb-6 flex items-center gap-2 px-3 text-lg font-semibold text-text">
          <Bell className="size-6 text-primary" aria-hidden />
          {BRAND.name}
        </Link>
        <nav aria-label={t("nav.primary")} className="flex flex-1 flex-col gap-1">
          {SIDE_NAV.map((item) => (
            <NavLink key={item.key} navKey={item.key} variant="sidebar" />
          ))}
        </nav>
        <div className="flex flex-col gap-1 border-t border-border pt-3">
          <Link href="/install" className="flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-medium text-text-2 hover:bg-surface-2">
            <Download className="size-5" aria-hidden />
            {t("install.cta")}
          </Link>
          <Link href="/profile" className="flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-medium text-text-2 hover:bg-surface-2">
            {user ? (
              <Avatar userId={user.id} name={user.name} url={user.avatarUrl} size={28} alt={avatarAlt} />
            ) : (
              <User className="size-5" aria-hidden />
            )}
            <span className="truncate">{user?.name || t("nav.profile")}</span>
          </Link>
          {user && (
            <SignOutButton className="flex min-h-11 w-full items-center gap-3 rounded-control px-3 text-sm font-medium text-text-2 hover:bg-surface-2" />
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-bg/90 px-4 backdrop-blur md:px-6 lg:justify-end lg:px-8">
          <span className="text-lg font-semibold lg:hidden">{BRAND.name}</span>
          <div className="flex items-center gap-1">
            <Link
              href="/notifications"
              aria-label={unread > 0 ? t("notifications.bell", { count: unread }) : t("nav.notifications")}
              className={`${ICON_BTN} relative`}
            >
              <Bell className="size-5" aria-hidden />
              {unread > 0 && (
                <span aria-hidden className="absolute top-1.5 right-1.5 flex min-w-4.5 items-center justify-center rounded-full bg-danger px-1 text-[0.6875rem] leading-4.5 font-semibold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <Link href="/profile" aria-label={t("nav.profile")} className={`${ICON_BTN} lg:hidden`}>
              {user ? (
                <Avatar userId={user.id} name={user.name} url={user.avatarUrl} size={32} alt="" />
              ) : (
                <User className="size-5" aria-hidden />
              )}
            </Link>
          </div>
        </header>

        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1200px] flex-1 px-4 pt-4 pb-28 outline-none md:px-6 md:pb-10 lg:px-8"
        >
          {children}
        </main>
      </div>

      <Fab />

      {/* Alsó fül-sáv (mobil) */}
      <nav
        aria-label={t("nav.primary")}
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface px-2 pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {BOTTOM_NAV.map((item) => (
          <NavLink key={item.key} navKey={item.key} variant="bottom" />
        ))}
        <MoreSheet />
      </nav>
    </div>
  );
}
