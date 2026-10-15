import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { RANGES, type Range } from "@/lib/analytics/range";
import { analyticsHref, type AnalyticsView } from "@/lib/analytics/url";
import { cn } from "@/lib/utils";

type State = { month: string; currentMonth: string; range: Range; view: AnalyticsView };

const CHIP = "flex min-h-11 items-center rounded-full border px-4 text-sm font-medium";
const CHIP_ON = "border-primary bg-primary-soft text-primary-text";
const CHIP_OFF = "border-border bg-surface text-text-2 hover:bg-surface-2";

// Időszak-chipek: a kiválasztott hónapban végződő tartomány (§15.1). Görgethető sor mobilon, ezért fókuszálható régió (axe).
export async function RangeChips(state: State) {
  const t = await getTranslations("analytics");
  return (
    <div role="region" aria-label={t("rangeLabel")} tabIndex={0} className="-mx-1 overflow-x-auto px-1">
      <ul className="flex w-max gap-2">
        {RANGES.map((r) => (
          <li key={r}>
            <Link
              href={analyticsHref({ ...state, range: r })}
              aria-current={state.range === r ? "true" : undefined}
              className={cn(CHIP, state.range === r ? CHIP_ON : CHIP_OFF)}
            >
              {t(`ranges.${r}`)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Diagram ⇄ Táblázat: mindenhol elérhető, az állapot az URL-ben él
export async function ViewToggle(state: State) {
  const t = await getTranslations("analytics");
  return (
    <nav aria-label={t("viewLabel")}>
      <ul className="flex rounded-full border border-border bg-surface p-0.5">
        {(["chart", "table"] as const).map((v) => (
          <li key={v}>
            <Link
              href={analyticsHref({ ...state, view: v })}
              aria-current={state.view === v ? "true" : undefined}
              className={cn("flex min-h-11 items-center rounded-full px-4 text-sm font-medium", state.view === v ? "bg-primary text-primary-fg" : "text-text-2 hover:bg-surface-2")}
            >
              {t(`view.${v}`)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
