import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// Memóriabeli, a supabase-js lekérdezés-építő szűk részhalmazát utánzó adatbázis a szolgáltatás-magok teszteléséhez.
// Az A-41 szabályait is utánozza, hogy a teszt a valódi viselkedést védje: a rendszer-szabály (user_id null) kliensről nem írható,
// a (user_id, match_key) egyedi, a kiadás törlése a főkönyvi sort `dismissed`-re állítja (tombstone-trigger).
export type Row = Record<string, unknown>;
type Err = { code?: string; message: string };

export class FakeDb {
  tables: Record<string, Row[]> = {};
  log: string[] = [];
  me = "user-1";
  private faults: { table: string; op: string; error: Err }[] = [];
  private seq = 0;

  seed(table: string, rows: Row[]) {
    this.tables[table] = [...(this.tables[table] ?? []), ...rows.map((r) => ({ ...r }))];
    return this;
  }
  rows(table: string) {
    return this.tables[table] ?? [];
  }
  failOn(table: string, op: "select" | "insert" | "update" | "delete", error: Err = { message: "boom" }) {
    this.faults.push({ table, op, error });
    return this;
  }
  clearFaults() {
    this.faults = [];
    return this;
  }
  fault(table: string, op: string) {
    return this.faults.find((f) => f.table === table && f.op === op)?.error ?? null;
  }
  nextId(prefix: string) {
    return `${prefix}-${++this.seq}`;
  }

  from(table: string) {
    return new Query(this, table);
  }
  // supabase-kliensként átadható
  client() {
    return this as unknown as SupabaseClient<Database>;
  }
}

type Filter = (row: Row) => boolean;

class Query implements PromiseLike<{ data: Row[] | Row | null; error: Err | null }> {
  private op: "select" | "insert" | "update" | "delete" = "select";
  private filters: Filter[] = [];
  private payload: Row = {};
  private max = Infinity;
  private wantsRows = false;
  private mode: "many" | "single" | "maybe" = "many";

  constructor(
    private db: FakeDb,
    private table: string,
  ) {}

  select() {
    this.wantsRows = true; // insert/update/delete után: az érintett sorok visszaadása
    return this;
  }
  insert(row: Row) {
    this.op = "insert";
    this.payload = row;
    return this;
  }
  update(patch: Row) {
    this.op = "update";
    this.payload = patch;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(col: string, value: unknown) {
    this.filters.push((r) => r[col] === value);
    return this;
  }
  neq(col: string, value: unknown) {
    this.filters.push((r) => r[col] !== value);
    return this;
  }
  is(col: string, value: null) {
    this.filters.push((r) => (r[col] ?? null) === value);
    return this;
  }
  not(col: string, _op: "is", value: null) {
    this.filters.push((r) => (r[col] ?? null) !== value);
    return this;
  }
  like(col: string, pattern: string) {
    const needle = pattern.replace(/^%|%$/g, "");
    this.filters.push((r) => typeof r[col] === "string" && (r[col] as string).includes(needle));
    return this;
  }
  limit(n: number) {
    this.max = n;
    return this;
  }
  maybeSingle() {
    this.mode = "maybe";
    return this;
  }
  single() {
    this.mode = "single";
    return this;
  }

  private matching() {
    return this.db.rows(this.table).filter((r) => this.filters.every((f) => f(r)));
  }

  // RLS (A-41): merchant_rules — a felhasználó csak a sajátját írhatja; a rendszer-szabály (user_id null) csak olvasható
  private writable(row: Row) {
    return this.table !== "merchant_rules" || row.user_id === this.db.me;
  }

  private run(): { data: Row[] | Row | null; error: Err | null } {
    const fault = this.db.fault(this.table, this.op);
    this.db.log.push(`${this.op}:${this.table}${this.op === "select" ? "" : ` ${JSON.stringify(this.payload)}`}`);
    if (fault) return { data: null, error: fault };
    const rows = this.db.rows(this.table);

    if (this.op === "insert") {
      const row: Row = { id: this.db.nextId(this.table), ...this.payload };
      if (this.table === "merchant_rules") {
        row.user_id = this.db.me;
        row.hits = 0;
        if (rows.some((r) => r.user_id === row.user_id && r.match_key === row.match_key)) return { data: null, error: { code: "23505", message: "duplicate key" } };
      }
      rows.push(row);
      this.db.tables[this.table] = rows;
      return this.shape(this.wantsRows ? [row] : null);
    }

    let hit = this.matching();
    if (this.op === "update") {
      hit = hit.filter((r) => this.writable(r));
      if (this.table === "merchant_rules" && typeof this.payload.match_key === "string") {
        const clash = rows.some((r) => r.user_id === this.db.me && r.match_key === this.payload.match_key && !hit.includes(r));
        if (clash) return { data: null, error: { code: "23505", message: "duplicate key" } };
      }
      for (const r of hit) Object.assign(r, this.payload);
      return this.shape(this.wantsRows ? hit : null);
    }
    if (this.op === "delete") {
      hit = hit.filter((r) => this.writable(r));
      this.db.tables[this.table] = rows.filter((r) => !hit.includes(r));
      if (this.table === "expenses") {
        // tombstone-trigger: a törölt kiadás főkönyvi sora dismissed lesz, a kapcsolat megszűnik
        for (const tx of this.db.rows("bank_transactions")) {
          if (hit.some((e) => e.id === tx.expense_id)) Object.assign(tx, { dismissed: true, expense_id: null });
        }
      }
      return this.shape(this.wantsRows ? hit : null);
    }
    return this.shape(hit.slice(0, this.max).map((r) => ({ ...r })));
  }

  private shape(data: Row[] | null): { data: Row[] | Row | null; error: Err | null } {
    if (this.mode === "many") return { data, error: null };
    if (!data || data.length === 0) return this.mode === "single" ? { data: null, error: { code: "PGRST116", message: "no rows" } } : { data: null, error: null };
    return { data: data[0], error: null };
  }

  then<T, U>(onfulfilled?: ((v: { data: Row[] | Row | null; error: Err | null }) => T | PromiseLike<T>) | null, onrejected?: ((e: unknown) => U | PromiseLike<U>) | null) {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
}
