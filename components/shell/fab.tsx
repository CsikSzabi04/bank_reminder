"use client";

import { Plus, ReceiptText, BellPlus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

// A "+" a Főoldalon és az Emlékeztetők lista oldalán látszik (§14.3); a fül-sáv fölött, jobbra.
// Koppintásra két művelet: új emlékeztető · gyors kiadás (§16.3)
const SHOW_ON = ["/dashboard", "/reminders"];

const ITEM = "flex min-h-12 items-center gap-3 rounded-control px-4 text-sm font-medium text-text hover:bg-surface-2";

export function Fab() {
  const pathname = usePathname();
  const t = useTranslations();
  // a menü az útvonalhoz kötött: oldalváltáskor magától zárt (nincs effekt-beli setState)
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // Esc és a menün kívüli koppintás zár
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    const onDown = (e: PointerEvent) => root.current && !root.current.contains(e.target as Node) && setOpenOn(null);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  if (!SHOW_ON.includes(pathname)) return null;

  return (
    // asztalon (≥1024) a fejlécben van "Új emlékeztető" gomb, a FAB ott eltakarná a sorok műveleteit
    <div ref={root} className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex flex-col items-end gap-2 md:right-6 md:bottom-6 lg:hidden">
      {open && (
        <ul id={menuId} className="flex w-56 flex-col rounded-card border border-border bg-surface p-1 shadow-card">
          <li>
            <Link href="/reminders/new" className={ITEM}>
              <BellPlus className="size-5 text-text-2" aria-hidden />
              {t("reminders.new")}
            </Link>
          </li>
          <li>
            <Link href="/budgets?add=expense" className={ITEM}>
              <ReceiptText className="size-5 text-text-2" aria-hidden />
              {t("expenses.title")}
            </Link>
          </li>
        </ul>
      )}
      <button
        type="button"
        aria-label={t("nav.add")}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpenOn(open ? null : pathname)}
        className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-fg shadow-card"
      >
        <Plus className={`size-6 transition-transform ${open ? "rotate-45" : ""}`} aria-hidden />
      </button>
    </div>
  );
}
