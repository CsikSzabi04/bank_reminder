"use client";

import { useEffect, type RefObject } from "react";
import type { ActionState } from "@/lib/action-state";

// Sikertelen küldés után a fókusz az első hibás mezőre ugrik (§14.4)
export function useFocusFirstError(state: ActionState | null, formRef: RefObject<HTMLFormElement | null>) {
  useEffect(() => {
    if (!state || state.ok) return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state, formRef]);
}
