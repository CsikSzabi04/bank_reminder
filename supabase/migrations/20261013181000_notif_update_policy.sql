-- A-14: a read_at csak a már esedékes in_app értesítéseken módosítható (a select-policyval egyező láthatóság).
drop policy if exists notif_update on public.notifications;
create policy notif_update on public.notifications for update to authenticated
  using ((select auth.uid()) = user_id and channel = 'in_app' and scheduled_for <= now())
  with check ((select auth.uid()) = user_id and channel = 'in_app' and scheduled_for <= now());
