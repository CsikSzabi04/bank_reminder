"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect } from "react";
import { PROFILE_SYNC_KEY } from "@/lib/constants";
import { setLocale } from "@/lib/i18n/actions";
import { isLocale } from "@/lib/i18n/config";
import { isTheme } from "@/lib/schemas/profile";

// Bejelentkezés után a profil téma/nyelv értéke az eszköz helyi beállítása elé kerül (§19.3),
// hogy a felület eszközök közt egységes legyen. Munkamenetenként (és felhasználónként) egyszer fut.
export function ProfileSync({ userId, theme, locale }: { userId: string; theme: string; locale: string }) {
  const { setTheme } = useTheme();
  const currentLocale = useLocale();
  const router = useRouter();

  useEffect(() => {
    try {
      if (sessionStorage.getItem(PROFILE_SYNC_KEY) === userId) return;
      sessionStorage.setItem(PROFILE_SYNC_KEY, userId);
    } catch {
      return; // privát ablak: nincs szinkron, a helyi beállítás marad
    }
    if (isTheme(theme)) setTheme(theme);
    if (isLocale(locale) && locale !== currentLocale) {
      void setLocale(locale).then(() => router.refresh());
    }
  }, [userId, theme, locale, currentLocale, router, setTheme]);

  return null;
}
