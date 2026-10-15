-- A-42 (kereskedő-szabályok) + az AI-B kérése: atomi besorolás. advanced.md §8.4.
-- A kulcs-alak (merchant_key = match_key): ékezet- és kisbetű-független, csak betű/szám/szóköz — a normalizálót a Deno-oldal adja
-- (supabase/functions/_shared/merchant.ts), a közös vektorokkal (tests/unit/bank-rules.test.ts ↔ merchant.test.ts).

-- ───────── 1) a tétel besorolása egyetlen tranzakcióban (a kliens nevében: RLS + oszlop-jogok érvényesek) ─────────
-- „Ezt mindig így": szabály (a felhasználó sajátja: új vagy a meglévő kategóriája frissül) + a várakozó, azonos kereskedős tételek (≤ 200)
-- Sorrend: ELŐSZÖR a kiadás (a keretek abból számolnak), utána a főkönyvi sor — egy függvényen belül ez már atomi.
-- Hibakódok (SQLSTATE): BR404 = nincs/nem a tiéd, BR422 = a tételhez nincs kereskedő-kulcs a szabályhoz.
create or replace function public.classify_bank_transaction(p_transaction uuid, p_category uuid, p_remember boolean default false)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare t public.bank_transactions; v_key text; v_rule uuid; n int := 1; r int;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into t from public.bank_transactions where id = p_transaction and user_id = auth.uid() and not dismissed;
  if not found then raise exception 'transaction_not_found' using errcode = 'BR404'; end if;
  -- az RLS csak a rendszer- és a saját kategóriát engedi látni
  if not exists (select 1 from public.categories c where c.id = p_category) then raise exception 'category_not_found' using errcode = 'BR404'; end if;
  v_key := case when p_remember then nullif(btrim(t.merchant_key), '') end;
  if p_remember and (v_key is null or char_length(v_key) < 2) then raise exception 'no_merchant_key' using errcode = 'BR422'; end if;

  update public.expenses set category_id = p_category where id = t.expense_id;
  update public.bank_transactions set category_id = p_category where id = t.id;

  if v_key is not null then
    update public.merchant_rules set category_id = p_category where user_id = auth.uid() and match_key = v_key returning id into v_rule;
    if v_rule is null then
      insert into public.merchant_rules (match_key, category_id) values (v_key, p_category) returning id into v_rule;
    end if;
    -- a „tartalmazza"-szemantika: a szabály-kulcs a merchant_key része (a position() nem minta → nincs %/_ probléma)
    with p as (
      select id, expense_id from public.bank_transactions
       where user_id = auth.uid() and category_id is null and not dismissed and id <> t.id and position(v_key in merchant_key) > 0
       order by booked_on desc, id limit 200),
    e as (update public.expenses x set category_id = p_category from p where x.id = p.expense_id returning x.id),
    b as (update public.bank_transactions y set category_id = p_category from p where y.id = p.id returning y.id)
    select count(*) into r from b;
    n := n + r;
  end if;
  return jsonb_build_object('classified', n, 'rule_id', v_rule);
end $$;

-- ───────── 2) „Ez nem kiadás": a kiadás törlődik (a tombstone a főkönyvi sort dismissed-re állítja), és a sor mindenképp dismissed ─────────
create or replace function public.dismiss_bank_transaction(p_transaction uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare t public.bank_transactions;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into t from public.bank_transactions where id = p_transaction and user_id = auth.uid();
  if not found then raise exception 'transaction_not_found' using errcode = 'BR404'; end if;
  if t.expense_id is not null then delete from public.expenses where id = t.expense_id; end if;
  update public.bank_transactions set dismissed = true where id = t.id;
end $$;

revoke execute on function public.classify_bank_transaction(uuid, uuid, boolean) from public, anon;
revoke execute on function public.dismiss_bank_transaction(uuid) from public, anon;
grant execute on function public.classify_bank_transaction(uuid, uuid, boolean) to authenticated;
grant execute on function public.dismiss_bank_transaction(uuid) to authenticated;

-- ───────── 3) szabály-illesztés a szerver-oldali beérkezéshez (webhook, szinkron): a legjobb találat kategóriája ─────────
-- Sorrend: a felhasználó saját szabálya mindig megelőzi a rendszer-javaslatot; azon belül a hosszabb kulcs; végül a régebbi. A találat `hits`-et növel.
create or replace function public.match_merchant_category(p_user uuid, p_key text, p_hit boolean default true)
returns uuid language plpgsql security definer set search_path = '' as $$
declare r public.merchant_rules;
begin
  if p_key is null or char_length(p_key) < 2 then return null; end if;
  select * into r from public.merchant_rules
   where (user_id = p_user or user_id is null) and position(match_key in p_key) > 0
   order by (user_id is not null) desc, char_length(match_key) desc, created_at, id limit 1;
  if not found then return null; end if;
  if p_hit then update public.merchant_rules set hits = hits + 1 where id = r.id; end if;
  return r.category_id;
end $$;
revoke execute on function public.match_merchant_category(uuid, text, boolean) from public, anon, authenticated;

-- ───────── 4) rendszer-javaslatok (user_id NULL, csak olvashatók) ─────────
-- Szándékosan rövid, jól ismert márkák, ≥ 4 karakteres megkülönböztető kulccsal (a „tartalmazza" illesztés a rövid kulcsnál téves találatot adna).
-- Javaslat, nem tény a kereskedőkről: a felhasználó saját szabálya mindig felülírja. A valódi bank-szövegminták (G-4) után bővítendő.
insert into public.merchant_rules (user_id, match_key, category_id)
select null, v.k, c.id
  from (values
    ('tesco', 'groceries'), ('interspar', 'groceries'), ('lidl', 'groceries'), ('aldi', 'groceries'), ('auchan', 'groceries'), ('penny market', 'groceries'),
    ('rossmann', 'household'), ('dm drogerie', 'household'),
    ('mcdonald', 'eating_out'), ('burger king', 'eating_out'), ('starbucks', 'eating_out'), ('wolt', 'eating_out'), ('foodpanda', 'eating_out'),
    ('netflix', 'streaming'), ('hbo max', 'streaming'), ('disney', 'streaming'), ('skyshowtime', 'streaming'), ('youtube premium', 'streaming'),
    ('spotify', 'music'), ('flixbus', 'transport'), ('decathlon', 'sports'), ('gyogyszertar', 'health'), ('benu', 'health')
  ) as v(k, cat)
  join public.categories c on c.key = v.cat and c.user_id is null
on conflict (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), match_key) do nothing;
