"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { mapDbError } from "@/lib/reminders/db-error";
import { createClient } from "@/utils/supabase/server";

// Új naptár-link: a régi azonnal érvénytelen (a token forgatása az A-oldali RPC-ben történik)
export async function rotateIcsToken(): Promise<ActionState> {
  const { error } = await createClient(await cookies()).rpc("rotate_ics_token");
  if (error) return mapDbError(error);
  revalidatePath("/calendar");
  return { ok: true };
}
