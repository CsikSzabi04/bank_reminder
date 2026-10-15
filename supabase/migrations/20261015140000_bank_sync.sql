-- A-48: banki szinkron — tárolás, napi plafon, cron, és az automatikus párosítás (esedékes számla → „kifizetve", megtakarítási cél → hozzájárulás).
-- Elvek (advanced.md §5.4): biztonság az elsődleges — kapcsolatonként napi ≤ 2 bank-hívás, kézi frissítés legalább 12 óránként;
-- a banki tétel EGYSZER számít: vagy kiadás, vagy egy esedékes számla kifizetése, vagy megtakarítási befizetés (soha nem több).

-- ───────── 1) kereskedő-kulcs SQL-ben (a felhasználó kulcsszavaihoz: bank_match) ─────────
-- A banki tétel `merchant_key`-ét a Deno-oldal adja (teljes Unicode); itt az ékezetek leggyakoribb (HU/közép-európai) eseteit hajtjuk össze,
-- a többi nem-ASCII jel szóközzé válik. A két oldal vektorai: supabase/functions/_shared/merchant.test.ts, supabase/tests/bank_sync.test.sql.
create or replace function public.normalize_merchant_key(p_text text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select btrim(regexp_replace(
           translate(lower(coalesce(p_text, '')), 'áàâäãåāăąćčçďéèêëēěęíìîïīńňñóòôöõőōřśšşťţúùûüűūůýÿźžż', 'aaaaaaaaacccdeeeeeeeiiiiinnnooooooorsssttuuuuuuuyyzzz'),
           '[^a-z0-9]+', ' ', 'g'))
$$;
revoke execute on function public.normalize_merchant_key(text) from public, anon;
grant execute on function public.normalize_merchant_key(text) to authenticated;

-- ───────── 2) séma-bővítés ─────────
alter table public.bank_transactions
  add column direction       text not null default 'debit' check (direction in ('debit', 'credit')),   -- az `amount` mindig pozitív; az irány külön
  add column counterparty    text check (char_length(counterparty) <= 120),
  add column remittance      text check (char_length(remittance) <= 300),
  add column occurrence_id   uuid references public.occurrences(id) on delete set null,                -- a kifizetett esedékes számla
  add column contribution_id uuid references public.goal_contributions(id) on delete set null;         -- a megtakarítási befizetés
create unique index bank_transactions_occurrence_once on public.bank_transactions (occurrence_id) where occurrence_id is not null;
create index bank_transactions_account on public.bank_transactions (user_id, account_ref, booked_on desc);

-- a felhasználó kulcsszava a banki szövegben (pl. „anthropic" a „Claude"-hoz); normalizáltan tárolódik (trigger)
alter table public.reminders     add column bank_match text check (char_length(bank_match) between 2 and 60);
alter table public.savings_goals add column bank_match text check (char_length(bank_match) between 2 and 60);

alter table public.bank_connections
  add column last_attempt_at timestamptz,    -- a legutóbbi (akár sikertelen) próbálkozás: ebből a 12 órás kézi korlát
  add column last_success_at timestamptz;    -- a legutóbbi SIKERES szinkron: az új lekérdezési ablak innen indul (−3 nap)

create or replace function public.normalize_bank_match() returns trigger
language plpgsql set search_path = '' as $$
declare k text;
begin
  k := public.normalize_merchant_key(new.bank_match);
  new.bank_match := case when char_length(k) >= 2 then left(k, 60) end;
  return new;
end $$;
revoke execute on function public.normalize_bank_match() from public, anon, authenticated;
create trigger reminders_bank_match before insert or update of bank_match on public.reminders for each row execute function public.normalize_bank_match();
create trigger savings_goals_bank_match before insert or update of bank_match on public.savings_goals for each row execute function public.normalize_bank_match();

-- ───────── 3) HTTP-hívás törzzsel (a meglévő call_edge_function csak üres törzset küld) ─────────
create or replace function public.call_edge_function(p_name text, p_body jsonb) returns bigint
language plpgsql security definer set search_path = '' as $$
declare secret text; req bigint;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'cron_secret' limit 1;
  if secret is null then raise warning 'cron_secret hiányzik a Vaultból — %: kihagyva', p_name; return null; end if;
  select net.http_post(
           url := 'https://ddvzslgwexvdolovqqlg.supabase.co/functions/v1/' || p_name,
           headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', secret),
           body := coalesce(p_body, '{}'::jsonb), timeout_milliseconds := 25000) into req;
  return req;
end $$;
revoke execute on function public.call_edge_function(text, jsonb) from public, anon, authenticated;

-- ───────── 4) a plafon: foglalás, sorba állítás, kézi kérés, lezárás ─────────
-- Egy bank-hívás-foglalás: napi legfeljebb 2 kapcsolatonként (a CHECK is védi), kézi legalább 12 óránként, automatikus legalább 20 óránként.
create or replace function public.reserve_bank_sync(p_connection uuid, p_source text, p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.bank_connections; tz text; today date; cnt int; nxt timestamptz;
begin
  if p_source not in ('manual', 'auto') then raise exception 'bad source' using errcode = '22023'; end if;
  select * into c from public.bank_connections where id = p_connection for update;
  if not found then raise exception 'connection_not_found' using errcode = 'BR404'; end if;
  if c.status <> 'active' or c.consent_valid_until <= p_now then return jsonb_build_object('status', 'not_active'); end if;
  select timezone into tz from public.profiles where id = c.user_id;
  today := (p_now at time zone coalesce(tz, 'UTC'))::date;
  cnt := case when c.sync_count_day = today then c.sync_count_today else 0 end;
  if c.last_attempt_at is not null then
    nxt := c.last_attempt_at + case when p_source = 'manual' then interval '12 hours' else interval '20 hours' end;
    if p_now < nxt then return jsonb_build_object('status', 'too_soon', 'next_allowed_at', nxt); end if;
  end if;
  if cnt >= 2 then return jsonb_build_object('status', 'daily_limit'); end if;
  update public.bank_connections set sync_count_today = cnt + 1, sync_count_day = today, last_attempt_at = p_now where id = c.id;
  return jsonb_build_object('status', 'queued');
end $$;

-- foglalás + a bank-sync Edge Function azonnali (aszinkron) meghívása erre az egy kapcsolatra
create or replace function public.queue_bank_sync(p_connection uuid, p_source text, p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r jsonb; req bigint;
begin
  r := public.reserve_bank_sync(p_connection, p_source, p_now);
  if r ->> 'status' = 'queued' then
    req := public.call_edge_function('bank-sync', jsonb_build_object('connection_id', p_connection, 'source', p_source, 'reserved', true));
    -- hiányzó cron_secret: a szinkron nem indulhatna el → hiba (a foglalás is visszagörgetődik), nem hamis „queued"
    if req is null then raise exception 'sync_unavailable' using errcode = 'BR503'; end if;
    r := r || jsonb_build_object('request_id', req);
  end if;
  return r;
end $$;

-- a „Frissítés most" gomb (B-41): { status: queued | too_soon | daily_limit | not_active, next_allowed_at? }; idegen/nemlétező kapcsolat → P0002
create or replace function public.request_bank_sync(p_connection_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.bank_connections where id = p_connection_id and user_id = auth.uid()) then
    raise exception 'connection not found' using errcode = 'P0002';
  end if;
  return public.queue_bank_sync(p_connection_id, 'manual');
end $$;

-- a futás vége: eredmény; a lejárt/megtagadott hozzáférés (p_expire) `expired` állapotot kap
create or replace function public.finish_bank_sync(p_connection uuid, p_ok boolean, p_error text default null, p_expire boolean default false, p_now timestamptz default now())
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.bank_connections
     set last_sync_at = p_now, last_sync_ok = p_ok, last_error = case when p_ok then null else left(p_error, 300) end,
         last_success_at = case when p_ok then p_now else last_success_at end,
         status = case when p_expire and status = 'active' then 'expired' else status end
   where id = p_connection;
end $$;

-- ───────── 5) a beérkező banki tételek feldolgozása (egy számla, egy köteg) ─────────
-- p_rows: [{ref, booked_on, amount (pozitív), currency, direction, counterparty, remittance, merchant_key}] — a Deno-oldal normalizálja.
-- Tételenként: duplikátum → kihagyva (ujjlenyomat) · jóváírás → csak tárolva · terhelés → (1) egy esedékes számla kifizetése, VAGY
-- (2) megtakarítási befizetés, VAGY (3) kiadás (kategória: a szabályokból) — soha nem több. Idempotens, bármikor újrafuttatható.
create or replace function public.ingest_bank_transactions(p_connection uuid, p_account_ref text, p_rows jsonb, p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c public.bank_connections; rec record; v_fp text; v_id uuid; v_ref text; v_n int; v_seen jsonb := '{}'::jsonb; v_txt text;
  occ_id uuid; occ_status text; goal_id uuid; contrib_id uuid; cat_id uuid; exp_id uuid;
  n_new int := 0; n_dup int := 0; n_skip int := 0; n_cred int := 0; n_paid int := 0; n_linked int := 0; n_goal int := 0; n_exp int := 0;
begin
  select * into c from public.bank_connections where id = p_connection and status = 'active';
  if not found then raise exception 'connection_not_found' using errcode = 'BR404'; end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'rows must be an array' using errcode = '22023'; end if;
  -- csak a kapcsolat saját számlájára lehet írni (kulcs: identification_hash:pénznem — mint a B-oldalon)
  if not exists (select 1 from jsonb_array_elements(c.accounts) a where (a ->> 'identification_hash') || ':' || (a ->> 'currency') = p_account_ref) then
    raise exception 'unknown account' using errcode = '22023';
  end if;

  for rec in
    select r.ref, r.booked_on, r.amount, upper(r.currency) as currency, r.direction, left(r.counterparty, 120) as counterparty,
           left(r.remittance, 300) as remittance, left(r.merchant_key, 60) as merchant_key
      from rows from (jsonb_to_recordset(p_rows) as (ref text, booked_on date, amount numeric, currency text, direction text, counterparty text, remittance text, merchant_key text))
           with ordinality as r(ref, booked_on, amount, currency, direction, counterparty, remittance, merchant_key, ord)
     order by r.ord
  loop
    if rec.booked_on is null or rec.amount is null or rec.amount <= 0 or coalesce(rec.currency, '') !~ '^[A-Z]{3}$' or coalesce(rec.direction, '') not in ('debit', 'credit') then
      n_skip := n_skip + 1; continue;
    end if;

    -- ujjlenyomat: a banki referencia, ennek híján a tartalom + sorszám az azonos tartalmú tételek között (két azonos kávé nem olvad össze)
    v_ref := nullif(btrim(rec.ref), '');
    if v_ref is not null then
      v_fp := encode(sha256(convert_to(c.user_id::text || '|' || p_account_ref || '|' || v_ref, 'UTF8')), 'hex');
    else
      v_txt := md5(rec.booked_on::text || '|' || rec.amount::text || '|' || rec.currency || '|' || rec.direction || '|' || coalesce(rec.merchant_key, '') || '|' || coalesce(rec.remittance, ''));
      v_n := coalesce((v_seen ->> v_txt)::int, 0) + 1;
      v_seen := jsonb_set(v_seen, array[v_txt], to_jsonb(v_n));
      v_fp := encode(sha256(convert_to(c.user_id::text || '|' || p_account_ref || '|c|' || v_txt || '|' || v_n, 'UTF8')), 'hex');
    end if;

    insert into public.bank_transactions (user_id, connection_id, source, status, amount, currency, booked_on, merchant, merchant_key, fingerprint,
                                          account_ref, external_ref, direction, counterparty, remittance)
    values (c.user_id, c.id, 'bank', 'booked', rec.amount, rec.currency, rec.booked_on, left(rec.counterparty, 80), rec.merchant_key, v_fp,
            p_account_ref, v_ref, rec.direction, rec.counterparty, rec.remittance)
    on conflict (user_id, fingerprint) do nothing
    returning id into v_id;
    if v_id is null then n_dup := n_dup + 1; continue; end if;
    n_new := n_new + 1;

    if rec.direction = 'credit' then n_cred := n_cred + 1; continue; end if;

    v_txt := btrim(coalesce(rec.merchant_key, '') || ' ' || public.normalize_merchant_key(rec.remittance));

    -- (1) esedékes (vagy már kézzel kifizetett) számla: azonos pénznem, összeg ±5%, a kulcsszó (saját `bank_match`, ennek híján a név) szerepel a szövegben
    occ_id := null;
    select o.id, o.status into occ_id, occ_status
      from public.occurrences o
      join public.reminders r on r.id = o.reminder_id
      cross join lateral (select coalesce(r.bank_match, case when char_length(public.normalize_merchant_key(r.name)) >= 3 then public.normalize_merchant_key(r.name) end) as k) m
     where o.user_id = c.user_id and o.status in ('upcoming', 'paid') and o.currency = rec.currency
       and o.due_date between rec.booked_on - 35 and rec.booked_on + 10
       and abs(o.amount - rec.amount) <= greatest(1, o.amount * 0.05)
       and m.k is not null and position(m.k in v_txt) > 0
       and not exists (select 1 from public.bank_transactions b where b.occurrence_id = o.id)
     order by abs(o.due_date - rec.booked_on), (o.status = 'upcoming') desc, o.due_date
     limit 1;
    if occ_id is not null then
      if occ_status = 'upcoming' then
        update public.occurrences set status = 'paid', paid_on = rec.booked_on, paid_amount = rec.amount, paid_at = p_now, snoozed_until = null where id = occ_id;
        perform public.cancel_occurrence_notifications(occ_id, p_now);
        n_paid := n_paid + 1;
      else
        n_linked := n_linked + 1;   -- a felhasználó már kifizetettnek jelölte: csak összekötjük, hogy ne legyen kétszer kiadás
      end if;
      update public.bank_transactions set occurrence_id = occ_id where id = v_id;
      continue;
    end if;

    -- (2) megtakarítási cél: a kulcsszó szerepel a szövegben → befizetés (a leghosszabb kulcsszó nyer)
    goal_id := null;
    select g.id into goal_id from public.savings_goals g
     where g.user_id = c.user_id and g.archived_at is null and g.bank_match is not null and position(g.bank_match in v_txt) > 0
     order by char_length(g.bank_match) desc, g.created_at limit 1;
    if goal_id is not null then
      insert into public.goal_contributions (goal_id, user_id, amount, contributed_on, note)
      values (goal_id, c.user_id, rec.amount, rec.booked_on, 'Bank') returning id into contrib_id;
      update public.bank_transactions set contribution_id = contrib_id where id = v_id;
      n_goal := n_goal + 1;
      continue;
    end if;

    -- (3) kiadás; a kategória a szabályokból (saját > rendszer)
    cat_id := public.match_merchant_category(c.user_id, rec.merchant_key, true);
    insert into public.expenses (user_id, category_id, amount, currency, spent_on, source, is_provisional, merchant)
    values (c.user_id, cat_id, rec.amount, rec.currency, rec.booked_on, 'bank', false, left(coalesce(rec.counterparty, rec.remittance), 80))
    returning id into exp_id;
    update public.bank_transactions set expense_id = exp_id, category_id = cat_id where id = v_id;
    n_exp := n_exp + 1;
  end loop;

  return jsonb_build_object('inserted', n_new, 'duplicates', n_dup, 'skipped', n_skip, 'credits', n_cred, 'paid', n_paid, 'linked', n_linked,
                            'contributions', n_goal, 'expenses', n_exp);
end $$;

-- ───────── 6) jogosultságok + napi ütemezés ─────────
revoke execute on function public.reserve_bank_sync(uuid, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.queue_bank_sync(uuid, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.finish_bank_sync(uuid, boolean, text, boolean, timestamptz) from public, anon, authenticated;
revoke execute on function public.ingest_bank_transactions(uuid, text, jsonb, timestamptz) from public, anon, authenticated;
revoke execute on function public.request_bank_sync(uuid) from public, anon;
grant execute on function public.request_bank_sync(uuid) to authenticated;

-- naponta egyszer (≈ éjszaka); a függvény maga is csak a `reserve_bank_sync` után hív bankot → soha nem több a plafonnál
do $$
begin
  if exists (select 1 from cron.job where jobname = 'bank_sync') then perform cron.unschedule('bank_sync'); end if;
  perform cron.schedule('bank_sync', '40 3 * * *', $cron$select public.call_edge_function('bank-sync', '{"source":"auto"}'::jsonb)$cron$);
end $$;
