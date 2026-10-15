import { z } from "zod";
import { checkBankMatch } from "@/lib/bank/match";

// Az űrlap értékei (§14.6). A zod-üzenetek hibakódok: a UI a `reminders.form.error.<kód>` kulcsra képezi le.

export const CURRENCIES = ["HUF", "EUR", "USD", "GBP", "CHF", "PLN", "CZK", "RON"] as const;
export const RECURRENCE_MODES = ["once", "week", "month", "year", "custom"] as const;
export type RecurrenceMode = (typeof RECURRENCE_MODES)[number];
export const RECUR_UNITS = ["day", "week", "month", "year"] as const;
export const OFFSET_CHOICES = [0, 1, 2, 3, 7] as const;
export const MAX_OFFSETS = 5;
export const MAX_OFFSET_DAYS = 30;
export const CHANNELS = ["push", "email"] as const;
// A "Mit nézel itt?" szótár (CONTRACT_CHANGES: usage_tags); az `originals` kizárólagos
export const USAGE_TAGS = ["movies", "series", "originals", "sports", "kids", "documentary", "music", "other"] as const;

export const MAX_AMOUNT = 999_999_999_999.99; // numeric(14,2)

// "2 300,50" / "2300.5" / "2 300" → 2300.5. Érvénytelen szövegre null. NEM számol: csak értelmez (H9).
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[\s  ]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value <= MAX_AMOUNT ? value : null;
}

// Összeg-mező: szöveg → szám, hibakódokkal (a költségkeret és a gyors kiadás is ezt használja)
export const amountField = z
  .string()
  .trim()
  .min(1, "required")
  .transform((v, ctx) => {
    if (v.startsWith("-")) {
      ctx.addIssue({ code: "custom", message: "amountNegative" });
      return z.NEVER;
    }
    const parsed = parseAmount(v);
    if (parsed === null) {
      ctx.addIssue({ code: "custom", message: "amountInvalid" });
      return z.NEVER;
    }
    return parsed;
  });

export const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
export const optional = <T extends z.ZodType>(schema: T) => z.preprocess(emptyToUndefined, schema.optional());
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "invalidDate").refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "invalidDate");
const checkbox = z.string().optional().transform((v) => v === "on" || v === "1");

export const reminderSchema = z
  .object({
    name: z.string().trim().min(1, "required").max(80, "tooLong"),
    amount: amountField,
    currency: z.enum(CURRENCIES, "invalidCurrency"),
    categoryId: optional(z.uuid("invalid")),
    serviceSlug: optional(z.string().max(60, "tooLong")),
    isSubscription: checkbox,
    recurrence: z.enum(RECURRENCE_MODES, "invalid"),
    recurEvery: z.coerce.number("invalid").int("invalid").min(1, "invalid").max(60, "invalid").default(1),
    recurUnit: optional(z.enum(RECUR_UNITS, "invalid")),
    startDate: isoDate,
    monthEnd: checkbox,
    endDate: optional(isoDate),
    trialEndsOn: optional(isoDate),
    remindEnabled: checkbox,
    offsets: z
      .array(z.coerce.number("invalid").int("invalid").min(0, "offsetRange").max(MAX_OFFSET_DAYS, "offsetRange"))
      .max(MAX_OFFSETS, "tooManyOffsets"),
    remindTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "invalidTime"),
    channelPush: checkbox,
    channelEmail: checkbox,
    autoPaid: checkbox,
    note: optional(z.string().max(500, "noteTooLong")),
    url: optional(z.string().max(2000, "tooLong").regex(/^https?:\/\/\S+$/i, "urlInvalid")),
    // Bank-egyeztetés kulcsszó (A-48): a normalizált alak 2–60 karakter; a hiba a mező alatt jelenik meg
    bankMatch: optional(z.string().max(120, "tooLong")),
    usageTags: z.array(z.enum(USAGE_TAGS, "invalid")).max(10, "tooManyOffsets"),
  })
  .superRefine((v, ctx) => {
    if (v.endDate && v.endDate < v.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "endBeforeStart" });
    const match = checkBankMatch(v.bankMatch);
    if (!match.ok) ctx.addIssue({ code: "custom", path: ["bankMatch"], message: match.reason });
    // "custom" módban kell egység; az ismétlődés nélküli (once) tételnek nincs értelme gyakoriságnak
    if (v.recurrence === "custom" && !v.recurUnit) ctx.addIssue({ code: "custom", path: ["recurUnit"], message: "invalid" });
  });

export type ReminderInput = z.output<typeof reminderSchema>;

// A választott mód → (recur_unit, recur_every) a DB-nek (§8: once = unit null, every 1)
export function toRecurrence(v: Pick<ReminderInput, "recurrence" | "recurEvery" | "recurUnit">): {
  recur_unit: string | null;
  recur_every: number;
} {
  switch (v.recurrence) {
    case "once":
      return { recur_unit: null, recur_every: 1 };
    case "custom":
      return { recur_unit: v.recurUnit ?? "month", recur_every: v.recurEvery };
    default:
      return { recur_unit: v.recurrence, recur_every: 1 };
  }
}

// A FormData-ból a séma bemenetét építi: a többszörös mezők (offset, usageTag) tömbbé válnak
export function readReminderForm(formData: FormData): Record<string, unknown> {
  const base = Object.fromEntries(formData.entries());
  return { ...base, offsets: formData.getAll("offset"), usageTags: formData.getAll("usageTag") };
}
