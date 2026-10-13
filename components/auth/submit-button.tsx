"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

// pending alatt letiltva: dupla-submit védelem (§14.4)
export function SubmitButton({ children, pendingLabel }: { children: ReactNode; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-12 w-full rounded-control bg-primary px-5 font-medium text-primary-fg transition-opacity disabled:opacity-70"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
