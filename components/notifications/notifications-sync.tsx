"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Az app-jelvény (a lejárt + 3 napon belül esedékes tételek száma, §13.5) és a frissítés: a láthatóvá váló fülön,
// valamint a service worker push-üzenetére újratölti a szerver-adatot (harang-számláló, lista). Realtime nincs (v1).
export function NotificationsSync({ badge }: { badge: number }) {
  const router = useRouter();

  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (badge > 0) void nav.setAppBadge?.(badge).catch(() => {});
    else void nav.clearAppBadge?.().catch(() => {});
  }, [badge]);

  useEffect(() => {
    const onVisible = () => document.visibilityState === "visible" && router.refresh();
    const onMessage = (e: MessageEvent) => e.data?.type === "push" && router.refresh();
    document.addEventListener("visibilitychange", onVisible);
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [router]);

  return null;
}
