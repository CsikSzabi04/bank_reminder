"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

// A "+" a Főoldalon és az Emlékeztetők lista oldalán látszik (§14.3); a fül-sáv fölött, jobbra
const SHOW_ON = ["/dashboard", "/reminders"];

export function Fab() {
  const pathname = usePathname();
  const t = useTranslations("reminders");
  if (!SHOW_ON.includes(pathname)) return null;

  return (
    <Link
      href="/reminders/new"
      aria-label={t("new")}
      className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-fg shadow-card md:bottom-6 md:right-6 lg:right-8"
    >
      <Plus className="size-6" aria-hidden />
    </Link>
  );
}
