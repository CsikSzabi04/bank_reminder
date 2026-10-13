"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth/safe-next";
import { confirmSchema } from "@/lib/schemas/auth";
import { createClient } from "@/utils/supabase/server";

// A verifyOtp CSAK gombnyomásra fut (nem az oldal betöltésekor): az e-mail-szkennerek előzetes
// linkmegnyitása így nem égeti el az egyszer használható tokent.
export async function confirmOtp(formData: FormData): Promise<never> {
  const parsed = confirmSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/login?error=linkExpired");
  const { token_hash, type, next } = parsed.data;

  const supabase = createClient(await cookies());
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });
  if (error) {
    redirect(
      type === "recovery"
        ? "/forgot-password?error=otp_expired"
        : `/check-email?type=${type}&error=otp_expired`,
    );
  }
  redirect(safeNext(next, type === "recovery" ? "/reset-password" : "/dashboard"));
}
