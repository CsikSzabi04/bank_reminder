// AI-A tulajdona. Kézzel karbantartott típusok a jsonb-t visszaadó RPC-khez (a table-visszatérésűek a database.types.ts-ben vannak).
// Szerződés: ARCHITECTURE.md §21.2. Összegek az alap-pénznemben (profiles.base_currency); dátumok 'YYYY-MM-DD'.

export type GroupKey =
  | 'subscriptions' | 'housing' | 'telecom' | 'insurance_tax' | 'loans_fees' | 'everyday' | 'lifestyle' | 'other';

export interface DashboardSummary {
  /** a hónap első napja */
  month: string;
  base_currency: string;
  hero: {
    /** fizetett + hátralévő (a lejárati hónap szerint; a kihagyott nem számít) */
    total: number;
    paid: number;
    remaining: number;
    prev_total: number;
    /** null, ha az előző hónap 0 → a UI „—"-t mutat */
    delta_pct: number | null;
    /** hány tételnek hiányzik az árfolyama (ezek kimaradnak az összegekből) → a UI jelezze */
    unconverted: number;
  };
  groups: Array<{
    /** diagram-szín slot (ARCHITECTURE.md §15.3): 1–7, 9 = egyéb */
    group_slot: number;
    group_key: GroupKey;
    total: number;
    paid: number;
    remaining: number;
    items: number;
  }>;
  /** a következő (legfeljebb 5) ki nem fizetett esedékesség, a lejártak elöl */
  upcoming: Array<{
    occurrence_id: string;
    reminder_id: string;
    name: string;
    due_date: string;
    amount: number;
    currency: string;
    amount_base: number | null;
    overdue: boolean;
    is_subscription: boolean;
    category_id: string | null;
    service_slug: string | null;
  }>;
  subscriptions: {
    monthly_total: number;
    yearly_total: number;
    count: number;
    items: Array<{ reminder_id: string; name: string; service_slug: string | null; monthly: number }>;
  };
  /** A-11 tölti (budget_status top 3); addig üres tömb */
  budgets: Array<{
    category_id: string;
    monthly_limit: number;
    spent: number;
    committed: number;
    state: 'ok' | 'watch' | 'over';
  }>;
  /** A-21 tölti; addig null */
  tip: { id: string; code: string; severity: 'info' | 'save' | 'warn'; params: Record<string, unknown>; est_monthly_saving: number | null } | null;
}
