export const LOCALES = ["hu", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "hu";
export const LOCALE_COOKIE = "NEXT_LOCALE";
export const LOCALE_COOKIE_OPTIONS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax",
} as const;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

// Sorrend: profil (belépve) → süti → Accept-Language → hu (§20.1). A profil-nyelvet a hívó adja át.
export function resolveLocale(input: {
  profile?: string | null;
  cookie?: string | null;
  acceptLanguage?: string | null;
}): Locale {
  if (isLocale(input.profile)) return input.profile;
  if (isLocale(input.cookie)) return input.cookie;
  // "en-US,en;q=0.9,hu;q=0.8": a q-érték szerinti sorrendben az első támogatott nyelv
  const ranked = (input.acceptLanguage ?? "")
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { tag: tag.toLowerCase().split("-")[0], q: q ? Number(q.trim().slice(2)) : 1, index };
    })
    .filter((x) => x.tag && Number.isFinite(x.q))
    .sort((a, b) => b.q - a.q || a.index - b.index);
  for (const { tag } of ranked) if (isLocale(tag)) return tag;
  return DEFAULT_LOCALE;
}
