"use client";

import { useTranslations } from "next-intl";
import type { ActionState } from "@/lib/action-state";
import type { AuthErrorReason } from "@/lib/auth/errors";
import { Notice } from "./notice";

const REASONS: readonly AuthErrorReason[] = [
  "invalidCredentials",
  "emailNotConfirmed",
  "weakPassword",
  "tooManyEmails",
  "tooManyRequests",
  "linkExpired",
  "samePassword",
  "generic",
];

// Űrlap-szintű hiba. A mező-hibákat a mezők maguk mutatják, itt csak a "reason" és az általános hiba jelenik meg.
export function FormAlert({ state }: { state: ActionState | null }) {
  const t = useTranslations("auth.error");
  if (!state || state.ok) return null;
  const reason = REASONS.find((r) => r === state.reason);
  if (!reason && state.code === "validation" && state.fieldErrors) return null;
  return <Notice variant="error">{t(reason ?? "generic")}</Notice>;
}
