import { z } from "zod";
import { amountField, isoDate, optional } from "./reminder";

// Költségkeret és gyors kiadás űrlapjai. A zod-üzenetek hibakódok (a `reminders.form.error.<kód>` kulcsra képezi le a UI).
export const budgetSchema = z.object({
  categoryId: z.uuid("invalid"),
  limit: amountField,
});

export const expenseSchema = z.object({
  amount: amountField,
  categoryId: optional(z.uuid("invalid")),
  spentOn: isoDate,
  note: optional(z.string().trim().max(200, "noteTooLong")),
});

export type BudgetInput = z.input<typeof budgetSchema>;
export type ExpenseInput = z.input<typeof expenseSchema>;
