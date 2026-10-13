import { describe, expect, it } from "vitest";
import { deviceLabel, detectPlatform, urlBase64ToUint8Array } from "@/lib/push-client";

const UA = {
  win: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  edge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0",
  android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36",
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  firefox: "Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0",
};
const env = (userAgent: string, platform = "", maxTouchPoints = 0) => ({ userAgent, platform, maxTouchPoints });

describe("urlBase64ToUint8Array (VAPID kulcs)", () => {
  it("base64url → bájtok, kitöltés nélkül is", () => {
    // "Hello?" = SGVsbG8_ (base64url, '?' → '_')
    expect([...urlBase64ToUint8Array("SGVsbG8_")]).toEqual([...new TextEncoder().encode("Hello?")]);
  });
  it("a - és _ karaktereket a + és / szerint értelmezi; 65 bájtos P-256 kulcs hossza megmarad", () => {
    const key = "BEl62iUYgUivxIkv69yViEuiBIa-ib37ccYJ9vGD2HQ5EEoUBqkMUBwOz-Ke0zFPAt7x7SdsQd1hbRVKjdY1d4s";
    const bytes = urlBase64ToUint8Array(key);
    expect(bytes).toHaveLength(65);
    expect(bytes[0]).toBe(0x04); // tömörítetlen EC pont jelzője
  });
});

describe("detectPlatform / deviceLabel", () => {
  it("platformok", () => {
    expect(detectPlatform(env(UA.win, "Win32"))).toBe("windows");
    expect(detectPlatform(env(UA.android, "Linux armv8l", 5))).toBe("android");
    expect(detectPlatform(env(UA.iphone, "iPhone", 5))).toBe("ios");
    expect(detectPlatform(env(UA.mac, "MacIntel"))).toBe("macos");
    expect(detectPlatform(env(UA.firefox, "Linux x86_64"))).toBe("linux");
    expect(detectPlatform(env("curl/8", ""))).toBe("other");
  });
  it("az iPadOS (Macnek öltözve) iOS", () => {
    expect(detectPlatform(env(UA.mac, "MacIntel", 5))).toBe("ios");
  });
  it("címke: böngésző · rendszer; Brave felülír; ismeretlen böngésző nem dob hibát", () => {
    expect(deviceLabel(env(UA.win, "Win32"))).toBe("Chrome · Windows");
    expect(deviceLabel(env(UA.edge, "Win32"))).toBe("Edge · Windows");
    expect(deviceLabel(env(UA.win, "Win32"), true)).toBe("Brave · Windows");
    expect(deviceLabel(env(UA.iphone, "iPhone", 5))).toBe("Safari · iOS");
    expect(deviceLabel(env(UA.firefox, "Linux x86_64"))).toBe("Firefox · Linux");
    expect(deviceLabel(env("valami", ""))).toBe("Browser");
  });
});
