"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { createClient } from "@/utils/supabase/server";

// A megerősítő szó nyelvtől függetlenül elfogadott (kis/nagybetű nem számít): a felület nyelvétől függő szót kérünk, de a másikat sem utasítjuk el
const WORDS = new Set(["TÖRLÖM", "DELETE"]);

// Fiók törlése (GDPR, §19.4): szöveges megerősítés → Edge Function `delete-account` (a felhasználó JWT-jével; avatar-fájlok
// törlése + auth.users törlése, a kaszkád viszi az adatot) → kijelentkeztetés → búcsú-oldal. Visszavonhatatlan.
export async function deleteAccount(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const typed = String(formData.get("confirm") ?? "").trim().toLocaleUpperCase("hu");
  if (!WORDS.has(typed)) return { ok: false, code: "validation", fieldErrors: { confirm: ["confirmMismatch"] } };

  const supabase = createClient(await cookies());
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return { ok: false, code: "unauthenticated" };

  const { error } = await supabase.functions.invoke("delete-account", { body: { confirm: "DELETE" } });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    console.error("delete-account failed", { status: status ?? 0 });
    return { ok: false, code: status === 401 ? "unauthenticated" : "upstream_failed" };
  }

  // a felhasználó már nincs: a helyi sütik törlése (a hiba nem akadály)
  try {
    await supabase.auth.signOut();
  } catch {
    /* a session már érvénytelen */
  }
  redirect("/goodbye");
}
