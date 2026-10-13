import type { CategoryView } from "@/lib/category-icons";

// Típusos mintaadat a /dev/ui játszótérhez és a komponens-tesztekhez (§21.7). Az összegek ILLUSZTRÁCIÓK.
export const FIXTURE_TODAY = "2026-10-13";

export const FIXTURE_CATEGORIES = {
  streaming: { id: "c-streaming", icon: "tv", colorSlot: 1, name: "Streaming" },
  utilities: { id: "c-utilities", icon: "zap", colorSlot: 2, name: "Rezsi" },
  internet: { id: "c-internet", icon: "wifi", colorSlot: 3, name: "Internet és TV" },
  insurance: { id: "c-insurance", icon: "shield-check", colorSlot: 4, name: "Biztosítás" },
  loans: { id: "c-loans", icon: "banknote", colorSlot: 5, name: "Hitel, törlesztés" },
  groceries: { id: "c-groceries", icon: "shopping-basket", colorSlot: 6, name: "Élelmiszer" },
  sports: { id: "c-sports", icon: "dumbbell", colorSlot: 7, name: "Sport, fitness" },
  other: { id: "c-other", icon: "circle-ellipsis", colorSlot: 9, name: "Egyéb" },
} satisfies Record<string, CategoryView>;

export type FixtureRow = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  dueDate: string;
  status: "upcoming" | "paid" | "skipped";
  category: CategoryView | null;
  unit: string | null;
  every: number;
  startDate: string;
  monthEnd?: boolean;
  demo?: boolean;
  notifyOff?: boolean;
};

// A sorok a különböző állapotokat fedik le: lejárt, ma, holnap, 3 nap, távoli, kifizetett, kihagyott, USD, kategória nélküli
export const FIXTURE_ROWS: FixtureRow[] = [
  { id: "r1", name: "Albérlet", amount: 140000, currency: "HUF", dueDate: "2026-10-10", status: "upcoming", category: FIXTURE_CATEGORIES.utilities, unit: "month", every: 1, startDate: "2026-01-10" },
  { id: "r2", name: "Áram", amount: 14200, currency: "HUF", dueDate: "2026-10-13", status: "upcoming", category: FIXTURE_CATEGORIES.utilities, unit: "month", every: 1, startDate: "2026-01-13" },
  { id: "r3", name: "Netflix", amount: 2300, currency: "HUF", dueDate: "2026-10-14", status: "upcoming", category: FIXTURE_CATEGORIES.streaming, unit: "month", every: 1, startDate: "2025-11-14", demo: true },
  { id: "r4", name: "Internet", amount: 6990, currency: "HUF", dueDate: "2026-10-16", status: "upcoming", category: FIXTURE_CATEGORIES.internet, unit: "month", every: 1, startDate: "2026-02-16" },
  { id: "r5", name: "Spotify", amount: 9.99, currency: "USD", dueDate: "2026-10-28", status: "upcoming", category: FIXTURE_CATEGORIES.streaming, unit: "month", every: 1, startDate: "2026-03-28", notifyOff: true },
  { id: "r6", name: "Casco biztosítás", amount: 184500, currency: "HUF", dueDate: "2027-03-02", status: "upcoming", category: FIXTURE_CATEGORIES.insurance, unit: "year", every: 1, startDate: "2025-03-02" },
  { id: "r7", name: "Hitel törlesztés", amount: 89900, currency: "HUF", dueDate: "2026-10-05", status: "paid", category: FIXTURE_CATEGORIES.loans, unit: "month", every: 1, startDate: "2024-05-05" },
  { id: "r8", name: "Edzőterem", amount: 12900, currency: "HUF", dueDate: "2026-10-08", status: "skipped", category: FIXTURE_CATEGORIES.sports, unit: "month", every: 1, startDate: "2026-01-08" },
  { id: "r9", name: "Telefon (heti)", amount: 1500, currency: "HUF", dueDate: "2026-10-19", status: "upcoming", category: null, unit: "week", every: 1, startDate: "2026-09-21" },
  { id: "r10", name: "Közös költség", amount: 22000, currency: "HUF", dueDate: "2026-10-31", status: "upcoming", category: FIXTURE_CATEGORIES.other, unit: "month", every: 1, startDate: "2026-01-31", monthEnd: true },
  { id: "r11", name: "Egyszeri díj", amount: 5000, currency: "HUF", dueDate: "2026-11-20", status: "upcoming", category: FIXTURE_CATEGORIES.other, unit: null, every: 1, startDate: "2026-11-20" },
];
