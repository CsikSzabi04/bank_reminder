import "server-only";
import { headers } from "next/headers";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";

// Az e-mailben lévő link visszatérő origin-je. A Supabase a Redirect URLs listával amúgy is szűri (§10.5).
export async function getOrigin(): Promise<string> {
  return (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export function validationFailure(error: z.ZodError): Extract<ActionState, { ok: false }> {
  return { ok: false, code: "validation", fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[]> };
}
