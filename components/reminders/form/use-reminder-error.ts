"use client";

import { useTranslations } from "next-intl";
import type hu from "@/locales/hu.json";

type Code = keyof (typeof hu)["reminders"]["form"]["error"];

const CODES = [
  "required",
  "tooLong",
  "amountInvalid",
  "amountNegative",
  "invalidCurrency",
  "invalidDate",
  "startInPast",
  "endBeforeStart",
  "tooManyOffsets",
  "offsetRange",
  "invalidTime",
  "urlInvalid",
  "noteTooLong",
  "bankMatchShort",
  "bankMatchLong",
  "invalid",
  "insufficient",
] as const satisfies readonly Code[];

const isCode = (code: string): code is Code => (CODES as readonly string[]).includes(code);

// A zod hibakód (lib/schemas/reminder.ts) → lokalizált szöveg; ismeretlen kód → általános hiba
export function useReminderErrorText() {
  const t = useTranslations("reminders.form.error");
  const generic = useTranslations("common.error")("generic");
  return (code: string | undefined) => (code && isCode(code) ? t(code) : generic);
}
