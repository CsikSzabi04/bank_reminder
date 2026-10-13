// Telepítés-állapotgép (§13.3). Tiszta függvény: a környezetet a hívó adja, így minden ág tesztelhető.

export type InstallState =
  | "installed" // már telepítve (standalone)
  | "promptable" // a böngésző felkínálja (beforeinstallprompt)
  | "ios" // iPhone/iPad Safari: kézi útmutató
  | "ios-other-browser" // iOS Chrome/Firefox/Edge: Safariban kell megnyitni
  | "mac-safari" // macOS Safari 17+: Fájl → Hozzáadás a Dockhoz
  | "unsupported" // Firefox asztali, régi böngésző, webview
  | "dismissed"; // a felhasználó elutasította: 7 napig nem erőszakoskodunk

export type InstallEnv = {
  standalone: boolean;
  hasPrompt: boolean;
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  /** a "Később" lejárata (ms epoch); a /install oldal ezt nem adja át */
  dismissedUntil?: number | null;
  now: number;
};

export const DISMISS_DAYS = 7;
export const DISMISS_KEY = "br_install_dismissed_until";

const WEBVIEW = /FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|; wv\)|Messenger/i;
const IOS_OTHER = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|GSA\//i;

// iPadOS 13+ Macnek hazudja magát ("MacIntel" + érintés) → a touch pontok száma dönt
export const isIOS = (e: Pick<InstallEnv, "userAgent" | "platform" | "maxTouchPoints">) =>
  /iPhone|iPad|iPod/.test(e.userAgent) || (e.platform === "MacIntel" && e.maxTouchPoints > 1);

export function detectInstallState(e: InstallEnv): InstallState {
  if (e.standalone) return "installed";
  if (WEBVIEW.test(e.userAgent)) return "unsupported";

  let state: InstallState;
  if (isIOS(e)) {
    state = IOS_OTHER.test(e.userAgent) ? "ios-other-browser" : "ios";
  } else if (e.hasPrompt) {
    state = "promptable";
  } else if (e.platform === "MacIntel" && /Safari\//.test(e.userAgent) && !/Chrome|Chromium|Edg\//.test(e.userAgent)) {
    const version = Number(e.userAgent.match(/Version\/(\d+)/)?.[1] ?? 0);
    state = version >= 17 ? "mac-safari" : "unsupported";
  } else {
    state = "unsupported";
  }

  if (e.dismissedUntil && e.dismissedUntil > e.now && state !== "unsupported") return "dismissed";
  return state;
}

export const dismissUntil = (now: number, days = DISMISS_DAYS) => now + days * 86_400_000;
