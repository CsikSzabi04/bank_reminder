"use client";

import { savePushSubscription } from "@/lib/push/actions";
import {
  deviceLabel,
  detectPlatform,
  isBrave,
  pushSupport,
  serviceWorkerReady,
  toPayload,
  urlBase64ToUint8Array,
  type PushResult,
} from "@/lib/push-client";

const fail = (reason: Extract<PushResult, { ok: false }>["reason"]): PushResult => ({ ok: false, reason });

// Feliratkozás (§12.4). CSAK felhasználói gesztusból hívható (gombnyomás): az engedélykérés is ide tartozik.
export async function enablePush(vapidKey: string | null, standalone: boolean): Promise<PushResult> {
  // fejlesztői módban nincs service worker (a cache-first statikus fájlok elavult kódot adnának)
  if (process.env.NODE_ENV !== "production") return fail("dev_mode");

  const support = pushSupport(standalone);
  if (!support.supported) return fail("unsupported");
  if (support.iosNeedsInstall) return fail("ios_not_installed");
  if (!vapidKey) return fail("subscribe_failed");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return fail(permission === "denied" ? "denied" : "dismissed");

  const reg = await serviceWorkerReady();
  if (!reg) return fail("subscribe_failed");

  let sub = await reg.pushManager.getSubscription();
  const brave = await isBrave();
  try {
    sub ??= await reg.pushManager.subscribe({
      userVisibleOnly: true, // iOS/Safari kötelező
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
  } catch {
    return fail(brave ? "brave_push_service" : "subscribe_failed");
  }

  const payload = toPayload(sub);
  if (!payload) return fail("subscribe_failed");
  const saved = await savePushSubscription({
    ...payload,
    platform: detectPlatform(navigator),
    label: deviceLabel(navigator, brave),
  });
  return saved.ok ? { ok: true } : fail("server_rejected");
}

// Kikapcsolás ezen az eszközön: a böngésző-feliratkozás megszüntetése (a szerver-oldali sort a hívó törli)
export async function disablePush(): Promise<void> {
  const reg = await serviceWorkerReady();
  const sub = await reg?.pushManager.getSubscription();
  await sub?.unsubscribe();
}
