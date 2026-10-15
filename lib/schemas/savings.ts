import { z } from "zod";
import { checkBankMatch } from "@/lib/bank/match";
import { GOAL_COLOR_SLOTS, GOAL_ICON_KEYS } from "@/lib/savings/icons";
import { amountField, isoDate, optional } from "./reminder";

// Megtakarítási cél és befizetés/kivét űrlapja. A zod-üzenetek hibakódok (`reminders.form.error.<kód>`).
export const goalSchema = z
  .object({
    name: z.string().trim().min(1, "required").max(60, "tooLong"),
    target: amountField,
    targetDate: optional(isoDate),
    icon: z.enum(GOAL_ICON_KEYS, "invalid"),
    colorSlot: z.coerce
      .number("invalid")
      .refine((n) => (GOAL_COLOR_SLOTS as readonly number[]).includes(n), "invalid"),
    // Bank-egyeztetés kulcsszó (A-48): a banki terhelés ilyen szóval megtakarítási befizetésként könyvelődik; a normalizált alak 2–60 karakter
    bankMatch: optional(z.string().max(120, "tooLong")),
  })
  .superRefine((v, ctx) => {
    const match = checkBankMatch(v.bankMatch);
    if (!match.ok) ctx.addIssue({ code: "custom", path: ["bankMatch"], message: match.reason });
  });

export const contributionSchema = z.object({
  amount: amountField,
  direction: z.enum(["add", "withdraw"], "invalid"),
  contributedOn: isoDate,
  note: optional(z.string().trim().max(200, "noteTooLong")),
});
