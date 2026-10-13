import { z } from "zod";

export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];
export const isTheme = (value: unknown): value is Theme =>
  typeof value === "string" && (THEMES as readonly string[]).includes(value);

// A zod-üzenetek hibakódok (lásd components/auth/use-field-error.ts)
export const displayNameSchema = z.object({
  displayName: z.string().trim().min(1, "required").max(60, "tooLong"),
});
