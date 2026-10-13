import { z } from "zod";
import { LOCALES } from "@/lib/i18n/config";
import { passwordChecks } from "@/lib/auth/password";

// A zod-üzenetek hibakódok; a UI az `auth.field.<kód>` fordítási kulcsra képezi le
const email = z
  .string()
  .trim()
  .min(1, "required")
  .max(254, "tooLong")
  .pipe(z.email("invalidEmail"));

const password = z
  .string()
  .min(1, "required")
  .max(200, "tooLong")
  .superRefine((value, ctx) => {
    const c = passwordChecks(value);
    if (!c.length) ctx.addIssue({ code: "custom", message: "passwordLength" });
    if (!c.letter) ctx.addIssue({ code: "custom", message: "passwordLetter" });
    if (!c.digit) ctx.addIssue({ code: "custom", message: "passwordDigit" });
  });

// Űrlap-jelölőnégyzet: "on" = bepipálva, hiányzik = nem
const checkbox = z
  .string()
  .optional()
  .transform((v) => v === "on" || v === "1");

export const signUpSchema = z.object({
  displayName: z.string().trim().min(1, "required").max(60, "tooLong"),
  email,
  password,
  locale: z.enum(LOCALES),
  accept: checkbox.refine((v) => v, "acceptRequired"),
});

export const signInSchema = z.object({
  email,
  // belépéskor nem a erősségi szabályt ellenőrizzük, csak hogy nem üres
  password: z.string().min(1, "required").max(200, "tooLong"),
  remember: checkbox,
  next: z.string().max(2000).optional(),
});

export const emailOnlySchema = z.object({ email });

export const updatePasswordSchema = z
  .object({
    password,
    confirm: z.string().min(1, "required"),
    signOutOthers: checkbox,
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "mismatch" });

export const OTP_TYPES = ["signup", "recovery", "email_change", "magiclink", "invite", "email"] as const;
export type OtpType = (typeof OTP_TYPES)[number];

export const confirmSchema = z.object({
  token_hash: z.string().min(10).max(500),
  type: z.enum(OTP_TYPES),
  next: z.string().max(2000).optional(),
});
