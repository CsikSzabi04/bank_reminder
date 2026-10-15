-- A-47: a bank-összekötés adat-logikája SQL-ben (az Edge Function-ök csak az Enable-hívásokat végzik) — így helyben, mutációval tesztelhető.
-- Mind security definer, kizárólag service_role hívhatja (az Edge Function-ök); a kliens semmit nem ér el belőlük.
-- Hibakódok (SQLSTATE): BR404 = nincs/nem a tiéd, BR429 = túl sok összekötés-indítás.

-- megújításnál (újra-hitelesítés) a state-hez tartozik a meglévő kapcsolat
alter table public.bank_connect_states
  add column renew_connection_id uuid references public.bank_connections(id) on delete set null;

-- 1) indítás: a state (CSRF-védő, egyszer használatos, 10 perc) létrehozása; óránként legfeljebb 10 indítás felhasználónként
create or replace function public.start_bank_connect(p_user uuid, p_state text, p_renew uuid default null, p_now timestamptz default now())
returns void language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if p_renew is not null and not exists (select 1 from public.bank_connections where id = p_renew and user_id = p_user and status <> 'revoked') then
    raise exception 'connection_not_found' using errcode = 'BR404';
  end if;
  select count(*) into n from public.bank_connect_states where user_id = p_user and created_at > p_now - interval '1 hour';
  if n >= 10 then raise exception 'rate_limited' using errcode = 'BR429'; end if;
  insert into public.bank_connect_states (state, user_id, expires_at, created_at, renew_connection_id)
  values (p_state, p_user, p_now + interval '10 minutes', p_now, p_renew);
end $$;

-- 2) a state felhasználása: egyszer, a saját felhasználónak, lejárat előtt. Idegen/ismeretlen/újrahasznált → 'invalid' (nem árulja el, melyik)
create or replace function public.consume_bank_connect_state(p_state text, p_user uuid, p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.bank_connect_states;
begin
  select * into s from public.bank_connect_states where state = p_state and user_id = p_user for update;
  if not found or s.used_at is not null then return jsonb_build_object('status', 'invalid'); end if;
  if s.expires_at <= p_now then return jsonb_build_object('status', 'expired'); end if;
  update public.bank_connect_states set used_at = p_now where state = p_state and user_id = p_user;
  return jsonb_build_object('status', 'ok', 'renew_connection_id', s.renew_connection_id);
end $$;

-- 3) a kapcsolat rögzítése az Enable-session után
--  • megújítás (p_renew): a meglévő sor frissül; a számlánkénti `sync_enabled` megmarad (kulcs: identification_hash + pénznem), az új session-é a hozzáférés
--  • új kapcsolat: új sor; az azonos bank korábbi kapcsolatai `revoked` lesznek (egy bank = egy aktív kapcsolat)
-- Visszaadja a lecserélt/visszavont session-ök azonosítóit, hogy az Edge Function törölje őket az Enable-nél is.
create or replace function public.finish_bank_connection(
  p_user uuid, p_renew uuid, p_aspsp_name text, p_aspsp_country text, p_session_id text, p_accounts jsonb,
  p_authorized_at timestamptz, p_valid_until timestamptz)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.bank_connections; v_id uuid; v_old text[] := '{}'; merged jsonb;
begin
  if jsonb_typeof(p_accounts) is distinct from 'array' then raise exception 'accounts must be an array' using errcode = '22023'; end if;
  if p_renew is not null then
    select * into c from public.bank_connections where id = p_renew and user_id = p_user and status <> 'revoked' for update;
    if not found then raise exception 'connection_not_found' using errcode = 'BR404'; end if;
    select coalesce(jsonb_agg(
             case when o.elem is not null and (o.elem ? 'sync_enabled') then n.elem || jsonb_build_object('sync_enabled', o.elem -> 'sync_enabled') else n.elem end
             order by n.ord), '[]'::jsonb)
      into merged
      from jsonb_array_elements(p_accounts) with ordinality as n(elem, ord)
      left join lateral (
        select oe as elem from jsonb_array_elements(c.accounts) as oe
         where oe ->> 'identification_hash' = n.elem ->> 'identification_hash' and oe ->> 'currency' = n.elem ->> 'currency' limit 1) o on true;
    v_old := array[c.session_id];
    update public.bank_connections
       set session_id = p_session_id, accounts = merged, authorized_at = p_authorized_at, consent_valid_until = p_valid_until,
           status = 'active', last_error = null, last_sync_ok = null
     where id = c.id;
    v_id := c.id;
  else
    insert into public.bank_connections (user_id, aspsp_name, aspsp_country, session_id, accounts, authorized_at, consent_valid_until)
    values (p_user, p_aspsp_name, p_aspsp_country, p_session_id, p_accounts, p_authorized_at, p_valid_until)
    returning id into v_id;
    with r as (
      update public.bank_connections set status = 'revoked'
       where user_id = p_user and aspsp_name = p_aspsp_name and aspsp_country = p_aspsp_country and id <> v_id and status <> 'revoked'
       returning session_id)
    select coalesce(array_agg(session_id), '{}') into v_old from r;
  end if;
  return jsonb_build_object('connection_id', v_id, 'old_session_ids', to_jsonb(v_old));
end $$;

-- 4) visszavonás: a sor `revoked`; az Enable-session azonosítóját visszaadja a törléshez (már visszavont → null, idempotens)
create or replace function public.revoke_bank_connection(p_user uuid, p_connection uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare c public.bank_connections;
begin
  select * into c from public.bank_connections where id = p_connection and user_id = p_user for update;
  if not found then raise exception 'connection_not_found' using errcode = 'BR404'; end if;
  if c.status = 'revoked' then return jsonb_build_object('session_id', null); end if;
  update public.bank_connections set status = 'revoked' where id = c.id;
  return jsonb_build_object('session_id', c.session_id);
end $$;

revoke execute on function public.start_bank_connect(uuid, text, uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.consume_bank_connect_state(text, uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.finish_bank_connection(uuid, uuid, text, text, text, jsonb, timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.revoke_bank_connection(uuid, uuid) from public, anon, authenticated;
