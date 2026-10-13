"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(display-mode: standalone)";

function subscribe(callback: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function snapshot(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return window.matchMedia(QUERY).matches || iosStandalone;
}

// Telepített PWA-ban igaz (§10.3): ott a "Maradjak bejelentkezve" elrejtődik, és mindig bekapcsolt.
export function useStandalone(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
