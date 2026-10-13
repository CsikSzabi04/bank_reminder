"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ComponentProps } from "react";
import { TextField } from "./text-field";

// Jelszó-mező mutat/elrejt gombbal. A gomb nem része az űrlap-küldésnek (type="button").
export function PasswordField(props: Omit<ComponentProps<typeof TextField>, "type" | "adornment">) {
  const t = useTranslations("auth.password");
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      type={visible ? "text" : "password"}
      adornment={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? t("hide") : t("show")}
          className="flex size-11 items-center justify-center rounded-control text-text-2 hover:bg-surface"
        >
          {visible ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
        </button>
      }
    />
  );
}
