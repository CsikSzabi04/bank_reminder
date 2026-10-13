import { monogram, monogramColors } from "@/lib/avatar";
import { cn } from "@/lib/utils";

type Props = {
  userId: string;
  name: string | null;
  url: string | null;
  size?: number;
  alt: string;
  className?: string;
};

// Profilkép, vagy tartalékként a név kezdőbetűi a user_id-ból képzett színnel (§19.2).
// A kép 256 px-es kis WebP → sima <img>, nem next/image.
export function Avatar({ userId, name, url, size = 40, alt, className }: Props) {
  const box = { width: size, height: size };
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={alt} {...box} loading="lazy" className={cn("rounded-full object-cover", className)} />;
  }
  const { background, color } = monogramColors(userId);
  return (
    <span
      role="img"
      aria-label={alt}
      style={{ ...box, background, color, fontSize: Math.round(size * 0.4) }}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", className)}
    >
      <span aria-hidden>{monogram(name)}</span>
    </span>
  );
}
