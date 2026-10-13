// Web Push kliens-segédek (§12.4, §12.9). A feliratkozás CSAK felhasználói gesztusból indulhat.
import { isIOS } from "@/lib/install";

export type PushReason =
  | "unsupported"
  | "ios_not_installed"
  | "denied"
  | "dismissed"
  | "brave_push_service"
  | "subscribe_failed"
  | "server_rejected"
  | "dev_mode";
export type PushResult = { ok: true } | { ok: false; reason: PushReason };

// VAPID publikus kulcs (base64url) → bájtok az applicationServerKey-hez
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export type Platform = "android" | "ios" | "windows" | "macos" | "linux" | "other";

export function detectPlatform(e: { userAgent: string; platform: string; maxTouchPoints: number }): Platform {
  if (isIOS(e)) return "ios";
  if (/Android/i.test(e.userAgent)) return "android";
  if (/Windows/i.test(e.userAgent)) return "windows";
  if (/Mac/i.test(e.userAgent)) return "macos";
  if (/Linux|X11/i.test(e.userAgent)) return "linux";
  return "other";
}

const BROWSERS: [RegExp, string][] = [
  [/EdgA?\/|Edg\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser/, "Samsung Internet"],
  [/Firefox|FxiOS/, "Firefox"],
  [/CriOS|Chrome|Chromium/, "Chrome"],
  [/Safari/, "Safari"],
];

// Az eszköz-címke az „Eszközeim" listához (pl. „Chrome · Windows"); nem tartalmaz egyedi azonosítót
export function deviceLabel(e: { userAgent: string; platform: string; maxTouchPoints: number }, brave = false): string {
  const browser = brave ? "Brave" : (BROWSERS.find(([re]) => re.test(e.userAgent))?.[1] ?? "Browser");
  const os: Record<Platform, string> = { android: "Android", ios: "iOS", windows: "Windows", macos: "macOS", linux: "Linux", other: "" };
  const name = os[detectPlatform(e)];
  return name ? `${browser} · ${name}` : browser;
}

export async function isBrave(): Promise<boolean> {
  const brave = (navigator as Navigator & { brave?: { isBrave?: () => Promise<boolean> } }).brave;
  try {
    return (await brave?.isBrave?.()) === true;
  } catch {
    return false;
  }
}

export type PushSupport = { supported: boolean; iosNeedsInstall: boolean };

export function pushSupport(standalone: boolean): PushSupport {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  return { supported, iosNeedsInstall: supported && isIOS(navigator) && !standalone };
}

// A böngésző-feliratkozás szerver-oldali alakja (a Server Action-nek)
export type SubscriptionPayload = { endpoint: string; keys: { p256dh: string; auth: string } };

export function toPayload(sub: PushSubscription): SubscriptionPayload | null {
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return null;
  return { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } };
}

// SHA-256 hex: az eszköz-lista a végpontot nem adja ki a kliensnek, csak ezt az ujjlenyomatot (összevetéshez)
export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const READY_TIMEOUT_MS = 8000;

export async function serviceWorkerReady(): Promise<ServiceWorkerRegistration | null> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), READY_TIMEOUT_MS)),
  ]);
}
