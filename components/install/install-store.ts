"use client";

import { useSyncExternalStore } from "react";
import { detectInstallState, dismissUntil, DISMISS_KEY, type InstallState } from "@/lib/install";

// A beforeinstallprompt egyszer sül el és el kell tárolni (preventDefault), hogy a gombnyomásra hívhassuk (§13.3).
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

// A PwaInit hívja az alkalmazás indulásakor
export function captureInstallPrompt(): () => void {
  const onPrompt = (e: Event) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  };
  const onInstalled = () => {
    deferred = null;
    notify();
  };
  window.addEventListener("beforeinstallprompt", onPrompt);
  window.addEventListener("appinstalled", onInstalled);
  return () => {
    window.removeEventListener("beforeinstallprompt", onPrompt);
    window.removeEventListener("appinstalled", onInstalled);
  };
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
};

export function readNumber(key: string): number {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0; // privát ablak / tiltott tárhely: nincs emlékezés, de nem hiba
  }
}
export function writeNumber(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* nincs tárhely: figyelmen kívül hagyjuk */
  }
  notify();
}

export function useStoredNumber(key: string): number {
  return useSyncExternalStore(subscribe, () => readNumber(key), () => 0);
}

export function dismissInstall(days?: number) {
  writeNumber(DISMISS_KEY, dismissUntil(Date.now(), days));
}

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

// A telepítés-állapot a kliensen (szerveren null: nincs hidratálási eltérés). A snapshot stabil szöveg.
export function useInstallState(respectDismissal: boolean): { state: InstallState | null; prompt: () => Promise<boolean> } {
  const key = useSyncExternalStore(
    subscribe,
    () => {
      const state = detectInstallState({
        standalone: isStandalone(),
        hasPrompt: deferred !== null,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        maxTouchPoints: navigator.maxTouchPoints,
        dismissedUntil: respectDismissal ? readNumber(DISMISS_KEY) : null,
        now: Date.now(),
      });
      return state;
    },
    () => null,
  );

  const prompt = async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null; // az esemény egyszer használható
    if (outcome === "dismissed") dismissInstall();
    notify();
    return outcome === "accepted";
  };
  return { state: key, prompt };
}
