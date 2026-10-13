import type { CookieOptions } from "@supabase/ssr";

// Jelző süti: '1' = maradjon bejelentkezve, '0' = session-süti; hiányzó = '1'
export const REMEMBER_COOKIE = "br_remember";
export const FOUR_HUNDRED_DAYS = 60 * 60 * 24 * 400;

// Törlésnél (maxAge 0) érintetlen; különben a jelző szerint tartós vagy session-süti
export function applyPersistence(
  options: CookieOptions,
  remember: boolean,
): CookieOptions {
  if (options.maxAge === 0) return options;
  if (remember) {
    return { ...options, maxAge: options.maxAge ?? FOUR_HUNDRED_DAYS };
  }
  // maxAge/expires nélkül a süti a böngésző bezárásakor eltűnik
  const rest = { ...options };
  delete rest.maxAge;
  delete rest.expires;
  return rest;
}
