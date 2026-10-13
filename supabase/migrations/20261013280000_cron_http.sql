-- A-18 (2/2): a HTTP-alapú ütemezések — a függvények telepítése és a `cron_secret` beállítása UTÁN (scripts/setup-secrets.mjs, db:deploy).
-- Idempotens: előbb leveszi a korábbi azonos nevűt. UTC.
do $$
declare j text;
begin
  foreach j in array array['send_notifications', 'fx_refresh', 'news_ingest'] loop
    if exists (select 1 from cron.job where jobname = j) then perform cron.unschedule(j); end if;
  end loop;
end $$;

select cron.schedule('send_notifications', '* * * * *',    $$select public.call_edge_function('send-notifications')$$);
select cron.schedule('fx_refresh',         '30 16 * * 1-5', $$select public.call_edge_function('fx-refresh')$$);   -- az ECB ~16:00 CET körül publikál
select cron.schedule('news_ingest',        '*/30 * * * *', $$select public.call_edge_function('news-ingest')$$);
