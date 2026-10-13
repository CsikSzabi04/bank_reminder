"use client";

import { Check, Circle } from "lucide-react";
import { useTranslations } from "next-intl";
import { passwordChecks, passwordStrength } from "@/lib/auth/password";
import { cn } from "@/lib/utils";

const LEVELS = { empty: 0, weak: 1, ok: 2, strong: 3 } as const;

// Erősség-sáv + követelmény-lista. Minden jelzés szöveggel is megvan (nem csak szín).
export function PasswordStrength({ password }: { password: string }) {
  const t = useTranslations("auth.password");
  const strength = passwordStrength(password);
  const checks = passwordChecks(password);
  const level = LEVELS[strength];
  const items = [
    ["length", checks.length],
    ["letter", checks.letter],
    ["digit", checks.digit],
  ] as const;

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1" aria-hidden>
          {[1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn("h-1.5 flex-1 rounded-full", i <= level ? "bg-primary" : "bg-border")}
            />
          ))}
        </div>
        <span aria-live="polite" className="min-w-20 text-right text-text-2">
          {strength === "empty" ? "" : `${t("strength.label")}: ${t(`strength.${strength}`)}`}
        </span>
      </div>
      <ul className="flex flex-col gap-1 text-text-2">
        <li className="font-medium">{t("req.title")}</li>
        {items.map(([key, met]) => (
          <li key={key} className="flex items-center gap-2">
            {met ? <Check className="size-4 text-success-text" aria-hidden /> : <Circle className="size-4" aria-hidden />}
            <span>{t(`req.${key}`)}</span>
            <span className="sr-only">{met ? t("req.met") : t("req.unmet")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
