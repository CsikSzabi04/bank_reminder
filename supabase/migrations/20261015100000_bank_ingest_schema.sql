-- A-41: haladó kör séma + RLS (advanced.md §4). Additív: meglévő adat nem változik.
-- Elv: a kliens (authenticated) csak olvas, ahol lehet; minden írás security definer RPC-n vagy Edge Function-ön (service_role) át megy.
-- A titkot/azonosítót tartalmazó oszlopok (token_hash, session_id) oszlop-szintű SELECT-jog miatt a kliensnek nem is látszanak.

-- ───────── profil-bővítés ─────────
-- bank_sync_allowed: csak a gazda állítja (Enable Terms, advanced.md §2.1) → NEM kerül a kliens UPDATE-listájára
-- budget_alerts: keret-riasztás kapcsoló (a bank-hozzáférés lejárat-értesítésének NINCS kapcsolója)
alter table public.profiles
  add column bank_sync_allowed boolean not null default false,
  add column budget_alerts     boolean not null default true;
grant update (budget_alerts) on public.profiles to authenticated;

-- ───────── ingest_tokens (Android-webhook) ─────────
-- A nyers token SOHA nem tárolódik: sha256 hex. Létrehozás/visszavonás/app-lista: RPC (A-44).
create table public.ingest_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade default auth.uid(),
  token_hash   text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  prefix       text not null check (char_length(prefix) = 6),
  label        text check (char_length(label) <= 40),
  allowed_apps text[] not null default '{}' check (cardinality(allowed_apps) <= 20 and octet_length(array_to_string(allowed_apps, ',')) <= 2000),
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index ingest_tokens_user on public.ingest_tokens (user_id);

-- ───────── ingest_events (PII-mentes napló) ─────────
create table public.ingest_events (
  id        bigint generated always as identity primary key,
  user_id   uuid not null references auth.users(id) on delete cascade,
  token_id  uuid references public.ingest_tokens(id) on delete set null,
  app       text check (char_length(app) <= 200),
  outcome   text not null check (outcome in ('recorded','duplicate','ignored','unparsed','rejected')),
  raw_text  text check (char_length(raw_text) <= 600),
  at        timestamptz not null default now(),
  -- a nyers szöveg csak a feldolgozhatatlan eseménynél maradhat (adatminimalizálás); a cleanup 14 nap után törli (A-50)
  check (raw_text is null or outcome = 'unparsed')
);
create index ingest_events_user_at on public.ingest_events (user_id, at desc);
create index ingest_events_token on public.ingest_events (token_id);

-- ───────── bank_connections (egy bank-hozzáférés = egy Enable-session) ─────────
-- accounts: [{ uid, identification_hash, currency, cash_account_type, iban_last4|null, name|null, sync_enabled }]
--   • teljes IBAN SOHA (csak az utolsó 4 jegy) — az A-40 szerint az IBAN nem egyedi (HUF/USD ugyanazon az IBAN-on; a megtakarításnak nincs),
--     ezért a számla kulcsa az identification_hash + pénznem, az uid csak a session-en belül érvényes
create table public.bank_connections (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade default auth.uid(),
  provider            text not null default 'enable_banking' check (provider = 'enable_banking'),
  aspsp_name          text not null check (char_length(aspsp_name) <= 120),
  aspsp_country       char(2) not null check (aspsp_country ~ '^[A-Z]{2}$'),
  session_id          text not null check (char_length(session_id) <= 200),
  accounts            jsonb not null default '[]' check (jsonb_typeof(accounts) = 'array'),
  authorized_at       timestamptz not null,
  consent_valid_until timestamptz not null,
  status              text not null default 'active' check (status in ('active','expired','revoked','error')),
  last_sync_at        timestamptz,
  last_sync_ok        boolean,
  last_error          text check (char_length(last_error) <= 300),
  -- napi plafon-őr: a bank felé soha nem megy több hívás kapcsolatonként naponta 2-nél (advanced.md §5.4); a CHECK a végső biztosíték
  sync_count_today    smallint not null default 0 check (sync_count_today between 0 and 2),
  sync_count_day      date,
  created_at          timestamptz not null default now(),
  check (consent_valid_until > authorized_at),
  unique (user_id, session_id)
);
create index bank_connections_user on public.bank_connections (user_id);

-- ───────── bank_connect_states (CSRF-védő, egyszer használatos, rövid életű) ─────────
create table public.bank_connect_states (
  state      text primary key check (char_length(state) between 16 and 100),
  user_id    uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);
create index bank_connect_states_user on public.bank_connect_states (user_id);
create index bank_connect_states_expiry on public.bank_connect_states (expires_at);

-- ───────── bank_transactions (főkönyv: minden forrás tétele) ─────────
-- fingerprint: értesítésnél sha256(user|app|szöveg|perc); banknál sha256(user|számla|entry_reference) — az A-40 szerint az
--   entry_reference a kulcs (a Revolut transaction_id-ja mindig null), ennek híján tartalom-hash + sorszám (A-48)
create table public.bank_transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  connection_id uuid references public.bank_connections(id) on delete set null,
  source        text not null check (source in ('notification','bank')),
  status        text not null check (status in ('provisional','booked')),
  amount        numeric(14,2) not null check (amount > 0),               -- v1: csak terhelés
  currency      char(3) not null check (currency ~ '^[A-Z]{3}$'),
  booked_on     date not null,
  merchant      text check (char_length(merchant) <= 80),
  merchant_key  text check (char_length(merchant_key) <= 80),
  category_id   uuid references public.categories(id) on delete set null,
  fingerprint   text not null check (char_length(fingerprint) between 16 and 128),
  account_ref   text check (char_length(account_ref) <= 200),            -- bank: a számla identification_hash-e
  external_ref  text check (char_length(external_ref) <= 200),           -- bank: entry_reference (hiányában transaction_id)
  expense_id    uuid references public.expenses(id) on delete set null,
  matched_with  uuid references public.bank_transactions(id) on delete set null,
  dismissed     boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (user_id, fingerprint),
  check (matched_with is distinct from id)
);
create index bank_transactions_user_day on public.bank_transactions (user_id, booked_on desc);
create index bank_transactions_connection on public.bank_transactions (connection_id);
create index bank_transactions_expense on public.bank_transactions (expense_id) where expense_id is not null;
-- 1:1 egyeztetés: egy tételhez legfeljebb egy másik tétel mutathat (§5.3)
create unique index bank_transactions_matched_once on public.bank_transactions (matched_with) where matched_with is not null;

-- ───────── merchant_rules (kereskedő → kategória; rendszer-alapok: user_id IS NULL, csak olvashatók) ─────────
create table public.merchant_rules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade default auth.uid(),
  match_key   text not null check (char_length(match_key) between 2 and 60),
  category_id uuid not null references public.categories(id) on delete cascade,
  hits        int not null default 0 check (hits >= 0),
  created_at  timestamptz not null default now()
);
create index merchant_rules_user on public.merchant_rules (user_id);
create index merchant_rules_category on public.merchant_rules (category_id);
-- egy kulcs egyszer szerepelhet felhasználónként (és egyszer a rendszer-szinten)
create unique index merchant_rules_unique_key on public.merchant_rules (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), match_key);

-- ───────── meglévő táblák bővítése (additív) ─────────
alter table public.expenses
  add column source         text not null default 'manual' check (source in ('manual','notification','bank')),
  add column is_provisional boolean not null default false,
  add column merchant       text check (char_length(merchant) <= 80);

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('reminder','overdue','trial_end','digest','tip','news','system','budget','bank_consent'));

-- ───────── RLS ─────────
alter table public.ingest_tokens       enable row level security;
alter table public.ingest_events       enable row level security;
alter table public.bank_connections    enable row level security;
alter table public.bank_connect_states enable row level security;
alter table public.bank_transactions   enable row level security;
alter table public.merchant_rules      enable row level security;

create policy ingest_tokens_select on public.ingest_tokens for select to authenticated using ((select auth.uid()) = user_id);
create policy ingest_events_select on public.ingest_events for select to authenticated using ((select auth.uid()) = user_id);
create policy bank_connections_select on public.bank_connections for select to authenticated using ((select auth.uid()) = user_id);
-- bank_connect_states: szándékosan NINCS policy → a kliens semmit nem ér el (csak service_role)

create policy bank_transactions_select on public.bank_transactions for select to authenticated using ((select auth.uid()) = user_id);
create policy bank_transactions_update on public.bank_transactions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id
    and (category_id is null or exists (select 1 from public.categories c where c.id = category_id)));

create policy merchant_rules_select on public.merchant_rules for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));
create policy merchant_rules_insert on public.merchant_rules for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.categories c where c.id = category_id));
create policy merchant_rules_update on public.merchant_rules for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.categories c where c.id = category_id));
create policy merchant_rules_delete on public.merchant_rules for delete to authenticated using (user_id = (select auth.uid()));

-- ───────── jogosultságok (a Supabase alapból mindent ad → szűkítünk; az alap-privilégiumot visszavonjuk) ─────────
revoke all on public.ingest_tokens, public.ingest_events, public.bank_connections, public.bank_connect_states,
              public.bank_transactions, public.merchant_rules from anon, authenticated;

-- a token_hash és a session_id oszlop a kliensnek nem látszik
grant select (id, user_id, prefix, label, allowed_apps, last_used_at, revoked_at, created_at) on public.ingest_tokens to authenticated;
grant select on public.ingest_events to authenticated;
grant select (id, user_id, provider, aspsp_name, aspsp_country, accounts, authorized_at, consent_valid_until, status,
              last_sync_at, last_sync_ok, last_error, sync_count_today, sync_count_day, created_at)
  on public.bank_connections to authenticated;
grant select on public.bank_transactions to authenticated;
grant update (category_id, dismissed) on public.bank_transactions to authenticated;   -- „Ezt mindig így" / „Ez nem kiadás"
grant select on public.merchant_rules to authenticated;
grant insert (user_id, match_key, category_id), update (match_key, category_id) on public.merchant_rules to authenticated;
grant delete on public.merchant_rules to authenticated;

-- ───────── expenses: a forrás-jelzőket a kliens nem hamisíthatja ─────────
-- (az Edge Function-ök service_role-lal, a security definer RPC-k a tulajdonos jogával futnak → rájuk nem vonatkozik)
create or replace function public.expenses_guard_flags() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.source := 'manual'; new.is_provisional := false;
    elsif new.source is distinct from old.source or new.is_provisional is distinct from old.is_provisional then
      raise exception 'expenses.source / is_provisional kliensről nem módosítható' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.expenses_guard_flags() from public, anon, authenticated;
create trigger expenses_guard_flags before insert or update on public.expenses for each row execute function public.expenses_guard_flags();

-- ───────── tombstone: törölt kiadás nem éled újra (advanced.md §4) ─────────
-- BEFORE DELETE: az FK `on delete set null` csak utána futna, és elveszne, hogy a tételt a felhasználó törölte
create or replace function public.expenses_tombstone() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.bank_transactions set dismissed = true, expense_id = null where expense_id = old.id;
  return old;
end $$;
revoke execute on function public.expenses_tombstone() from public, anon, authenticated;
create trigger expenses_tombstone before delete on public.expenses for each row execute function public.expenses_tombstone();
