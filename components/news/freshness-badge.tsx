import { Clock, Sparkles } from "lucide-react";

// Frissesség-jelző (§18.3/4): Friss (< 24 óra) · nincs jelzés · „Lehet, hogy már nem aktuális" (a TTL > 70%-a eltelt).
// Ikon + szöveg, a szín nem az egyetlen jelzés.
export function FreshnessBadge({ freshness, label }: { freshness: "fresh" | "normal" | "stale"; label: string | null }) {
  if (freshness === "normal" || !label) return null;
  const Icon = freshness === "fresh" ? Sparkles : Clock;
  const tone = freshness === "fresh" ? "bg-success/15 text-success-text" : "bg-warning/20 text-warning-text";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      <Icon className="size-3" aria-hidden />
      {label}
    </span>
  );
}
