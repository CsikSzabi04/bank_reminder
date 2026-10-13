"use client";

import { Download, Ellipsis, User, X } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { MORE_NAV } from "./nav-items";

// "Még" lap mobilon. Natív <dialog>: fókuszcsapda, Esc és fókusz-visszaadás beépítve.
// A teljes BottomSheet komponens a B-10 feladat; ez arra cserélhető.
export function MoreSheet() {
  const t = useTranslations();
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => ref.current?.close();

  const row =
    "flex min-h-12 items-center gap-3 rounded-control px-3 text-base text-text hover:bg-surface-2";

  return (
    <>
      <button
        type="button"
        onClick={() => ref.current?.showModal()}
        aria-haspopup="dialog"
        className="flex min-h-12 min-w-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-control px-1 text-[11px] font-medium text-text-2 hover:bg-surface-2"
      >
        <Ellipsis className="size-5" aria-hidden />
        <span>{t("nav.more")}</span>
      </button>

      <dialog
        ref={ref}
        aria-label={t("nav.more")}
        onClick={(e) => e.target === ref.current && close()}
        className={cn(
          "m-0 mt-auto w-full max-w-none rounded-t-sheet border border-border bg-surface p-4 text-text",
          "pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop:bg-black/40",
        )}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("nav.more")}</h2>
          <button
            type="button"
            onClick={close}
            aria-label={t("common.close")}
            className="flex size-11 items-center justify-center rounded-control hover:bg-surface-2"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <nav aria-label={t("nav.more")}>
          <ul className="flex flex-col">
            {MORE_NAV.map(({ key, href, icon: Icon }) => (
              <li key={key}>
                <Link href={href} onClick={close} className={row}>
                  <Icon className="size-5 text-text-2" aria-hidden />
                  {t(`nav.${key}`)}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/profile" onClick={close} className={row}>
                <User className="size-5 text-text-2" aria-hidden />
                {t("nav.profile")}
              </Link>
            </li>
            <li>
              <Link href="/install" onClick={close} className={row}>
                <Download className="size-5 text-text-2" aria-hidden />
                {t("install.cta")}
              </Link>
            </li>
          </ul>
        </nav>
      </dialog>
    </>
  );
}
