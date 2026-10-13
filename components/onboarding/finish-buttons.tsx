import { getTranslations } from "next-intl/server";
import { finishOnboarding } from "@/lib/onboarding/actions";

// „Kihagyom" / „Kész": mindkettő onboarding_done = true és a Főoldal (a lépések bármikor kihagyhatók)
export async function SkipForm({ label, primary = false }: { label: string; primary?: boolean }) {
  return (
    <form action={finishOnboarding}>
      <button
        type="submit"
        className={
          primary
            ? "min-h-12 w-full rounded-control bg-primary px-5 font-medium text-primary-fg"
            : "min-h-11 rounded-control px-3 text-sm font-medium text-text-2 hover:bg-surface-2"
        }
      >
        {label}
      </button>
    </form>
  );
}

export async function Progress({ step }: { step: number }) {
  const t = await getTranslations("onboarding");
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm font-medium text-text-2" aria-live="polite">
        {t("progress", { step, total: 3 })}
      </p>
      <div aria-hidden className="flex gap-1.5">
        {[1, 2, 3].map((n) => (
          <span key={n} className={`h-1.5 w-8 rounded-full ${n <= step ? "bg-primary" : "bg-surface-2"}`} />
        ))}
      </div>
    </div>
  );
}
