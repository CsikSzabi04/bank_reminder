"use client";

import { useTranslations } from "next-intl";
import type hu from "@/locales/hu.json";

type FieldErrorCode = keyof (typeof hu)["auth"]["field"]["error"];

const CODES = [
  "required",
  "invalidEmail",
  "tooLong",
  "passwordLength",
  "passwordLetter",
  "passwordDigit",
  "mismatch",
  "acceptRequired",
] as const satisfies readonly FieldErrorCode[];

const isCode = (code: string): code is FieldErrorCode => (CODES as readonly string[]).includes(code);

// A zod hibakódot (lib/schemas/auth.ts) lokalizált szöveggé alakítja; ismeretlen kód → általános hiba
export function useFieldErrorText() {
  const t = useTranslations("auth.field.error");
  const generic = useTranslations("common.error")("generic");
  return (code: string | undefined) => (code && isCode(code) ? t(code) : generic);
}
