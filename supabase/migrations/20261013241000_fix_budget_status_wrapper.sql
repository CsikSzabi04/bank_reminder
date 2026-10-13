-- Javítás: a budget_status burkoló security definer (hívja a zárolt budget_status_for-t); az identitás továbbra is auth.uid().
create or replace function public.budget_status(p_month date default null)
returns table (budget_id uuid, category_id uuid, monthly_limit numeric, spent numeric, committed numeric,
               "left" numeric, state text, forecast numeric, suggested_limit numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  return query select * from public.budget_status_for(auth.uid(), p_month, public.user_today());
end $$;
revoke execute on function public.budget_status(date) from public, anon;
grant execute on function public.budget_status(date) to authenticated;
