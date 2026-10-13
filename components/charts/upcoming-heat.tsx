import Link from "next/link";

export type HeatDay = {
  date: string;
  /** a hónapnap száma (a cella fő felirata) */
  dayText: string;
  /** rövid hónapnév, csak az első cellán és a hónapok első napján */
  monthText?: string;
  /** teljes dátum a hozzáférhető névhez / tooltiphez */
  dateText: string;
  items: number;
  /** formázott összeg (kompakt); üres, ha nincs tétel */
  amountText: string;
  /** 0 = nincs tétel, 1–4 = a hőtérkép lépcsője */
  level: 0 | 1 | 2 | 3 | 4;
  dense: boolean;
  href: string;
  /** a teljes hozzáférhető név: dátum · tételszám · összeg (· sűrű nap) */
  label: string;
};

// A következő 30 nap (C6): hőtérkép-rács; a tételes napok linkek a naptárra. A szín mellett a cellában szám és összeg áll,
// a „sűrű" napot kerettel és a hozzáférhető névben is jelöljük (§15.4–15.5).
export function UpcomingHeat({ days, ariaLabel }: { days: HeatDay[]; ariaLabel: string }) {
  return (
    <ol aria-label={ariaLabel} className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
      {days.map((d) => {
        const style = d.level > 0 ? { background: `var(--heat-${d.level})`, color: `var(--heat-${d.level}-fg)` } : undefined;
        const ring = d.dense ? "outline-2 -outline-offset-2 outline-warning" : "";
        const body = (
          <>
            {d.monthText && <span className="text-[0.625rem] leading-none uppercase">{d.monthText}</span>}
            <span className="text-sm font-semibold tabular-nums">{d.dayText}</span>
            <span className="truncate text-[0.6875rem] leading-tight tabular-nums">{d.amountText}</span>
          </>
        );
        const cell = `flex min-h-14 min-w-0 flex-col items-center justify-center rounded-control px-1 py-1 text-center ${ring}`;
        return (
          <li key={d.date} className="min-w-0">
            {d.items > 0 ? (
              <Link href={d.href} aria-label={d.label} title={d.label} className={`${cell} hover:brightness-95`} style={style}>
                {body}
              </Link>
            ) : (
              <span title={d.dateText} className={`${cell} bg-surface-2 text-text-muted`}>
                {d.monthText && <span className="text-[0.625rem] leading-none uppercase">{d.monthText}</span>}
                <span className="text-sm tabular-nums">{d.dayText}</span>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
