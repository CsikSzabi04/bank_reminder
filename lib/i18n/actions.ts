"use server";

import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE } from "./config";

const ONE_YEAR = 60 * 60 * 24 * 365;

// Nyelvváltás: süti. A profiles.locale szinkron (belépve) a B-08 feladatban kerül ide.
export async function setLocale(locale: string): Promise<{ ok: boolean }> {
  if (!isLocale(locale)) return { ok: false };
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
  });
  return { ok: true };
}
