"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import type { Locale } from "@/lib/i18n/config";
import { LOCALES } from "@/lib/i18n/config";
import { mapDbError } from "@/lib/reminders/db-error";
import { createClient } from "@/utils/supabase/server";
import { buildNewsCards, type NewsCardData } from "./cards";
import { getNewsFeed, resolveTopic } from "./queries";

const db = async () => createClient(await cookies());
const REASONS = ["outdated", "wrong", "spam", "other"] as const;

// „Hibásnak tűnik?": egy felhasználó egy hírre egyszer jelenthet (unique) — a második próbálkozás „conflict"
export async function reportNews(newsId: string, reason: string): Promise<ActionState> {
  if (!z.uuid().safeParse(newsId).success || !(REASONS as readonly string[]).includes(reason)) return { ok: false, code: "validation" };
  const { error } = await (await db()).from("news_reports").insert({ news_id: newsId, reason });
  if (error) return mapDbError(error);
  return { ok: true };
}

const cursorSchema = z.object({ publishedAt: z.iso.datetime({ offset: true }), id: z.uuid() });

// „Továbbiak": a következő lap a kurzor után
export async function loadMoreNews(
  topic: string | undefined,
  cursor: { publishedAt: string; id: string },
  locale: string,
): Promise<{ ok: true; cards: NewsCardData[]; hasMore: boolean; next: { publishedAt: string; id: string } | null } | { ok: false }> {
  const c = cursorSchema.safeParse(cursor);
  if (!c.success || !(LOCALES as readonly string[]).includes(locale)) return { ok: false };
  const { items, failed } = await getNewsFeed(resolveTopic(topic), c.data);
  if (failed) return { ok: false };
  const last = items[items.length - 1];
  return { ok: true, cards: await buildNewsCards(items, locale as Locale), hasMore: items.length >= 12, next: last ? { publishedAt: last.publishedAt, id: last.id } : null };
}

export async function setNewsEnabled(enabled: boolean): Promise<ActionState> {
  const supabase = await db();
  const { data: auth } = await supabase.auth.getClaims();
  const uid = auth?.claims?.sub;
  if (!uid) return { ok: false, code: "unauthenticated" };
  const { error } = await supabase.from("profiles").update({ news_enabled: enabled }).eq("id", uid);
  if (error) return mapDbError(error);
  revalidatePath("/news");
  revalidatePath("/dashboard");
  return { ok: true };
}
