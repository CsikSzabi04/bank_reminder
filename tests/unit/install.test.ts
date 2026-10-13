import { describe, expect, it } from "vitest";
import { detectInstallState, dismissUntil, isIOS, type InstallEnv } from "@/lib/install";

const UA = {
  androidChrome: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36",
  winChrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  winFirefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0",
  iphoneSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  iphoneChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1",
  ipadOsSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  macSafari17: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  macSafari16: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15",
  macChrome: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  facebook: "Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0]",
};
const NOW = 1_800_000_000_000;
const env = (over: Partial<InstallEnv>): InstallEnv => ({
  standalone: false, hasPrompt: false, userAgent: UA.winChrome, platform: "Win32", maxTouchPoints: 0, now: NOW, ...over,
});

describe("detectInstallState (§13.3 állapotgép)", () => {
  it("installed: standalone mindent felülír", () => {
    expect(detectInstallState(env({ standalone: true, hasPrompt: true }))).toBe("installed");
    expect(detectInstallState(env({ standalone: true, userAgent: UA.iphoneSafari, maxTouchPoints: 5 }))).toBe("installed");
  });
  it("promptable: Chromium a beforeinstallprompt után (Android, Windows)", () => {
    expect(detectInstallState(env({ hasPrompt: true, userAgent: UA.androidChrome, platform: "Linux armv8l", maxTouchPoints: 5 }))).toBe("promptable");
    expect(detectInstallState(env({ hasPrompt: true }))).toBe("promptable");
  });
  it("prompt előtt a Chromium sem ígér telepítést (unsupported, amíg nincs esemény)", () => {
    expect(detectInstallState(env({ hasPrompt: false }))).toBe("unsupported");
  });
  it("ios: iPhone Safari; iPadOS Macnek öltözve (MacIntel + érintés) is", () => {
    expect(detectInstallState(env({ userAgent: UA.iphoneSafari, platform: "iPhone", maxTouchPoints: 5 }))).toBe("ios");
    expect(detectInstallState(env({ userAgent: UA.ipadOsSafari, platform: "MacIntel", maxTouchPoints: 5 }))).toBe("ios");
  });
  it("ios-other-browser: iOS-es Chrome", () => {
    expect(detectInstallState(env({ userAgent: UA.iphoneChrome, platform: "iPhone", maxTouchPoints: 5 }))).toBe("ios-other-browser");
  });
  it("mac-safari: Safari 17+ igen, 16 nem; Mac Chrome prompt nélkül unsupported", () => {
    expect(detectInstallState(env({ userAgent: UA.macSafari17, platform: "MacIntel" }))).toBe("mac-safari");
    expect(detectInstallState(env({ userAgent: UA.macSafari16, platform: "MacIntel" }))).toBe("unsupported");
    expect(detectInstallState(env({ userAgent: UA.macChrome, platform: "MacIntel" }))).toBe("unsupported");
    expect(detectInstallState(env({ userAgent: UA.macChrome, platform: "MacIntel", hasPrompt: true }))).toBe("promptable");
  });
  it("unsupported: Firefox asztali és beágyazott böngésző (webview)", () => {
    expect(detectInstallState(env({ userAgent: UA.winFirefox }))).toBe("unsupported");
    expect(detectInstallState(env({ userAgent: UA.facebook, hasPrompt: true }))).toBe("unsupported");
  });
  it("dismissed: a lejáratig; utána újra felkínál; a nem támogatottat nem rejti el", () => {
    const dismissed = dismissUntil(NOW);
    expect(detectInstallState(env({ hasPrompt: true, dismissedUntil: dismissed }))).toBe("dismissed");
    expect(detectInstallState(env({ hasPrompt: true, dismissedUntil: NOW - 1 }))).toBe("promptable");
    expect(detectInstallState(env({ userAgent: UA.iphoneSafari, platform: "iPhone", maxTouchPoints: 5, dismissedUntil: dismissed }))).toBe("dismissed");
    expect(detectInstallState(env({ userAgent: UA.winFirefox, dismissedUntil: dismissed }))).toBe("unsupported");
  });
  it("a Később 7 napig tart", () => {
    expect(dismissUntil(NOW)).toBe(NOW + 7 * 86_400_000);
  });
});

describe("isIOS", () => {
  it("Mac érintés nélkül nem iOS", () => {
    expect(isIOS({ userAgent: UA.macSafari17, platform: "MacIntel", maxTouchPoints: 0 })).toBe(false);
    expect(isIOS({ userAgent: UA.macSafari17, platform: "MacIntel", maxTouchPoints: 5 })).toBe(true);
  });
});
