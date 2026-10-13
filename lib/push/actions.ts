"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { validationFailure } from "@/lib/auth/server-utils";
import { mapDbError } from "@/lib/reminders/db-error";
import { MAX_OFFSET_DAYS, MAX_OFFSETS } from "@/lib/schemas/reminder";
import { createClient } from "@/utils/supabase/server";

const db = async () => createClient(await cookies());
const bad: ActionState = { ok: false, code: "validation" };

const subscriptionSchema = z.object({
  endpoint: z.url().max(1000).refine((u) => u.startsWith("https://"), "https"),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{20,200}$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{10,100}$/),
  }),
  platform: z.enum(["android", "ios", "windows", "macos", "linux", "other"]),
  label: z.string().trim().max(60),
});
export type SavePushInput = z.input<typeof subscriptionSchema>;

// Eszköz-feliratkozás mentése. A host-allowlistet és az eszköz-limitet (max. 10) az RPC érvényesíti (53400 / 23514).
export async function savePushSubscription(input: SavePushInput): Promise<ActionState> {
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return bad;
  const v = parsed.data;
  const userAgent = ((await headers()).get("user-agent") ?? "").slice(0, 300);

  const { error } = await (await db()).rpc("register_push_subscription", {
    p_endpoint: v.endpoint,
    p_p256dh: v.keys.p256dh,
    p_auth: v.keys.auth,
    p_platform: v.platform,
    p_user_agent: userAgent,
    p_label: v.label,
  });
  if (error) return mapDbError(error);
  revalidatePath("/profile");
  return { ok: true };
}

// Eszköz eltávolítása az „Eszközeim" listából (az RLS csak a saját sort engedi törölni)
export async function removeDevice(deviceId: string): Promise<ActionState> {
  if (!z.uuid().safeParse(deviceId).success) return bad;
  const { error } = await (await db()).from("push_subscriptions").delete().eq("id", deviceId);
  if (error) return mapDbError(error);
  revalidatePath("/profile");
  return { ok: true };
}

type TestResult = { sent: number; devices: number };

// Teszt-értesítés a TÉNYLEGES útvonalon (szerver → push-szolgáltató → SW); percenként legfeljebb 3 (az Edge Function limitje)
export async function sendTestPush(): Promise<ActionState<TestResult>> {
  const { data, error } = await (await db()).functions.invoke("send-test-push", { body: {} });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 429) return { ok: false, code: "rate_limited" };
    if (status === 401) return { ok: false, code: "unauthenticated" };
    return { ok: false, code: "upstream_failed" };
  }
  const r = (data ?? {}) as { ok?: boolean; sent?: number; devices?: number };
  if (!r.ok) return { ok: false, code: "upstream_failed" };
  return { ok: true, data: { sent: r.sent ?? 0, devices: r.devices ?? 0 } };
}

const checkbox = z.string().optional().transform((v) => v === "on" || v === "1");
const settingsSchema = z.object({
  remindersEnabled: checkbox,
  offsets: z.array(z.coerce.number().int("invalid").min(0, "offsetRange").max(MAX_OFFSET_DAYS, "offsetRange")).max(MAX_OFFSETS, "tooManyOffsets"),
  notifyTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "invalidTime"),
  channelPush: checkbox,
  channelEmail: checkbox,
  hideDetails: checkbox,
  weeklyDigest: checkbox,
});

// Profil → Értesítések: globális kapcsoló, alapértelmezések, csatornák, diszkrét mód, heti összefoglaló
export async function updateNotificationSettings(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const parsed = settingsSchema.safeParse({ ...Object.fromEntries(formData), offsets: formData.getAll("offset") });
  if (!parsed.success) return validationFailure(parsed.error);
  const v = parsed.data;

  const supabase = await db();
  const { data: auth } = await supabase.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (!uid) return { ok: false, code: "unauthenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({
      reminders_enabled: v.remindersEnabled,
      default_offsets: [...new Set(v.offsets)].sort((a, b) => a - b),
      default_notify_time: v.notifyTime,
      channel_push: v.channelPush,
      channel_email: v.channelEmail,
      notify_hide_details: v.hideDetails,
      weekly_digest: v.weeklyDigest,
    })
    .eq("id", uid);
  if (error) return mapDbError(error);
  revalidatePath("/profile");
  return { ok: true };
}

// Értesítések olvasottnak jelölése (RPC: csak a sajátok); ids nélkül mind
export async function markNotificationsRead(ids?: string[]): Promise<ActionState> {
  if (ids && !ids.every((i) => z.uuid().safeParse(i).success)) return bad;
  const { error } = await (await db()).rpc("mark_notifications_read", ids?.length ? { p_ids: ids } : {});
  if (error) return mapDbError(error);
  revalidatePath("/", "layout"); // a harang számlálója mindenhol frissüljön
  return { ok: true };
}
