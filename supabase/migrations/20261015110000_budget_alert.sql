-- A-45: azonnali keret-riasztás (advanced.md §7). A meglévő budget_status_for állapotait használja — új küszöb nincs.
-- Szint-átlépéskor, kategóriánként × hónaponként × szintenként EGYSZER (dedupe_key), csak a folyó hónapra.

create or replace function public.check_budget_alert(p_user uuid, p_category uuid, p_month date default null, p_now timestamptz default now())
returns int language plpgsql security definer set search_path = '' as $$
declare
  pr record; today date; ms date; st record; lvl text; chans text[]; ch text; v_month text; v_key text;
  v_hu text; v_en text; n int := 0; c int;
begin
  select timezone, base_currency, budget_alerts, channel_push into pr from public.profiles where id = p_user;
  if not found or not pr.budget_alerts then return 0; end if;

  today := (p_now at time zone pr.timezone)::date;
  ms := public.month_start(coalesce(p_month, today));
  -- múltbeli/jövőbeli hónapba könyvelt tétel (utólagos rögzítés) nem riaszt: a riasztás a MOST történő túllépésről szól
  if ms <> public.month_start(today) then return 0; end if;

  select * into st from public.budget_status_for(p_user, ms, today) b where b.category_id = p_category;
  if not found then return 0; end if;   -- nincs keret a kategóriára → nincs riasztás

  -- `over`: túllépve. `watch`: csak valódi költés alapján (≥ 80%) — a még ki nem fizetett számlák („committed") miatti watch
  -- állapotról a számla-emlékeztetők szólnak, azt nem „elfogyott keretként" jelezzük
  if st.state = 'over' then lvl := 'over';
  elsif st.state = 'watch' and st.spent >= 0.8 * st.monthly_limit then lvl := 'watch';
  else return 0;
  end if;

  v_month := to_char(ms, 'YYYY-MM');
  -- a túllépés után a „közel" szint már nem küldhető (a kettő sorrendje nem fordulhat meg egy hónapon belül)
  if lvl = 'watch' and exists (select 1 from public.notifications where dedupe_key like 'bud:' || p_user || ':' || p_category || ':' || v_month || ':over:%') then
    return 0;
  end if;

  select coalesce(name_hu, name_en, key, '—'), coalesce(name_en, name_hu, key, '—') into v_hu, v_en from public.categories where id = p_category;
  chans := array['in_app'] || case when pr.channel_push then array['push'] else array[]::text[] end;
  foreach ch in array chans loop
    v_key := 'bud:' || p_user || ':' || p_category || ':' || v_month || ':' || lvl || ':' || ch;
    insert into public.notifications (user_id, kind, channel, payload, scheduled_for, status, sent_at, dedupe_key)
    values (p_user, 'budget', ch,
            jsonb_build_object('level', lvl, 'category_id', p_category, 'category_name_hu', v_hu, 'category_name_en', v_en,
                               'month', v_month, 'spent', st.spent, 'limit', st.monthly_limit,
                               'pct', floor(st.spent / st.monthly_limit * 100), 'currency', pr.base_currency),
            p_now, case when ch = 'in_app' then 'sent' else 'pending' end, case when ch = 'in_app' then p_now end, v_key)
    on conflict (dedupe_key) do nothing;
    get diagnostics c = row_count; n := n + c;
  end loop;
  return n;
end $$;
revoke execute on function public.check_budget_alert(uuid, uuid, date, timestamptz) from public, anon, authenticated;

-- minden új/módosult kiadás után (kézi gyors kiadás, webhook, banki szinkron egyaránt) — a függvény idempotens, a dedupe véd az ismétléstől
create or replace function public.expenses_budget_alert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.category_id is null then return null; end if;
  -- olcsó előszűrés: csak ha van keret a kategóriára (a budget_status_for drágább)
  if not exists (select 1 from public.budgets b where b.user_id = new.user_id and b.category_id = new.category_id) then return null; end if;
  perform public.check_budget_alert(new.user_id, new.category_id, new.spent_on, now());
  return null;
end $$;
revoke execute on function public.expenses_budget_alert() from public, anon, authenticated;
create trigger expenses_budget_alert after insert or update of amount, currency, spent_on, category_id on public.expenses
  for each row execute function public.expenses_budget_alert();
