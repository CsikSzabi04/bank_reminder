import { AVATAR_BUCKET } from "@/lib/constants";

export type ImageType = "jpeg" | "png" | "webp";

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((b, i) => bytes[offset + i] === b);

// Magic byte alapú típusfelismerés (§11/H11): a fájlnévnek és a MIME-nek nem hiszünk.
// SVG, GIF és minden más (pl. HTML-be rejtett tartalom) → null.
export function detectImageType(bytes: Uint8Array): ImageType | null {
  if (bytes.length < 12) return null;
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  // WebP: "RIFF" + 4 bájt méret + "WEBP"
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  return null;
}

// A bucket publikus, ezért az URL közvetlenül képezhető (az avatar_path bucket-relatív)
export function avatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/${AVATAR_BUCKET}/${path}`;
}

// A név kezdőbetűi (legfeljebb 2): "Kiss Béla" → "KB"; üres név → "?"
export function monogram(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const letters = parts.length === 1 ? [...parts[0]].slice(0, 2) : [[...parts[0]][0], [...parts[parts.length - 1]][0]];
  return letters.join("").toLocaleUpperCase();
}

// §15.3 kategória-paletta (világos) — a monogram háttere; a szöveg a jobb kontrasztú fehér/sötét
const MONOGRAM_BACKGROUNDS = ["#2A78D6", "#EB6834", "#1BAF7A", "#EDA100", "#E87BA4", "#008300", "#6250D6"] as const;
const DARK_TEXT = "#0F1720";
const LIGHT_TEXT = "#FFFFFF";

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Determinisztikus szín a user_id-ból (ugyanaz a felhasználó mindig ugyanazt kapja)
export function monogramColors(userId: string): { background: string; color: string } {
  let hash = 0;
  for (const ch of userId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const background = MONOGRAM_BACKGROUNDS[hash % MONOGRAM_BACKGROUNDS.length];
  const color = contrastRatio(background, LIGHT_TEXT) >= contrastRatio(background, DARK_TEXT) ? LIGHT_TEXT : DARK_TEXT;
  return { background, color };
}

export const MONOGRAM_PALETTE_SIZE = MONOGRAM_BACKGROUNDS.length;
export const MONOGRAM_BACKGROUND_LIST: readonly string[] = MONOGRAM_BACKGROUNDS;
