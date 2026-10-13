-- A-06: core séma + RLS + Storage (ARCHITECTURE.md §8, §9). Additív, idempotensnek szánt első migráció.

-- ───────── segédek ─────────
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

create or replace function public.is_valid_timezone(tz text) returns boolean
language plpgsql stable set search_path = '' as $$
begin perform now() at time zone tz; return true; exception when others then return false; end $$;

-- ───────── profiles ─────────
create table public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  display_name          text check (char_length(display_name) <= 60),
  avatar_path           text,
  locale                text not null default 'hu' check (locale in ('hu','en')),
  theme                 text not null default 'system' check (theme in ('system','light','dark')),
  base_currency         char(3) not null default 'HUF' check (base_currency ~ '^[A-Z]{3}$'),
  timezone              text not null default 'Europe/Budapest',
  reminders_enabled     boolean not null default true,
  default_offsets       smallint[] not null default '{1}'
                          check (cardinality(default_offsets) <= 5 and 0 <= all(default_offsets) and 30 >= all(default_offsets)),
  default_notify_time   time not null default '09:00',
  channel_push          boolean not null default true,
  channel_email         boolean not null default false,
  notify_hide_details   boolean not null default false,
  weekly_digest         boolean not null default true,
  tips_enabled          boolean not null default true,
  news_enabled          boolean not null default true,
  monthly_income        numeric(14,2) check (monthly_income >= 0),
  ics_token             text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  onboarding_done       boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (public.is_valid_timezone(timezone))
);
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, locale)
  values (
    new.id,
    nullif(left(btrim(coalesce(new.raw_user_meta_data->>'display_name','')), 60), ''),
    case when new.raw_user_meta_data->>'locale' in ('hu','en') then new.raw_user_meta_data->>'locale' else 'hu' end
  );
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ───────── categories ─────────
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,        -- NULL = rendszer-kategória
  key         text,
  name_hu     text, name_en text,
  icon        text not null default 'tag',
  color_slot  smallint not null default 9 check (color_slot between 1 and 9 and color_slot <> 8),
  kind        text not null default 'both' check (kind in ('bill','expense','both')),
  sort        smallint not null default 0,
  created_at  timestamptz not null default now(),
  check (name_hu is not null or name_en is not null),
  check ((user_id is null) = (key is not null))                          -- rendszer: van key; saját: nincs
);
create unique index categories_system_key on public.categories (key) where user_id is null;
create index categories_user on public.categories (user_id);

-- ───────── service_catalog ─────────
create table public.service_catalog (
  slug                text primary key,
  name                text not null,
  category_key        text not null,
  group_key           text,
  logo_url            text, website text,
  typical_amount      numeric(14,2), typical_currency char(3),
  typical_unit        text not null default 'month' check (typical_unit in ('month','year')),
  annual_discount_pct numeric(5,2) check (annual_discount_pct between 0 and 100),
  family_plan         boolean not null default false,
  unique_tags         text[] not null default '{}',
  common_tags         text[] not null default '{}',
  verified_at         date not null,
  source_url          text,
  is_active           boolean not null default true
);

-- ───────── reminders ─────────
create table public.reminders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name             text not null check (char_length(name) between 1 and 80),
  amount           numeric(14,2) not null check (amount >= 0),
  currency         char(3) not null default 'HUF' check (currency ~ '^[A-Z]{3}$'),
  category_id      uuid references public.categories(id) on delete set null,
  service_slug     text references public.service_catalog(slug) on delete set null,
  is_subscription  boolean not null default false,
  recur_unit       text check (recur_unit in ('day','week','month','year')),
  recur_every      smallint not null default 1 check (recur_every between 1 and 60),
  start_date       date not null,
  month_end        boolean not null default false,
  end_date         date,
  trial_ends_on    date,
  remind_enabled   boolean not null default true,
  remind_offsets   smallint[] not null default '{1}',
  remind_time      time not null default '09:00',
  channels         text[] not null default '{push}',
  auto_paid        boolean not null default false,
  note             text check (char_length(note) <= 500),
  url              text check (url ~ '^https?://'),
  usage_tags       text[] not null default '{}',
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (recur_unit is not null or recur_every = 1),
  check (end_date is null or end_date >= start_date),
  check (cardinality(remind_offsets) <= 5 and 0 <= all(remind_offsets) and 30 >= all(remind_offsets)),
  check (channels <@ array['push','email']::text[]),
  check (cardinality(usage_tags) <= 10)
);
create index reminders_user_active on public.reminders (user_id) where is_active;
create index reminders_category on public.reminders (category_id);
create trigger reminders_updated before update on public.reminders for each row execute function public.set_updated_at();

-- ───────── occurrences ─────────
create table public.occurrences (
  id             uuid primary key default gen_random_uuid(),
  reminder_id    uuid not null references public.reminders(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  due_date       date not null,
  amount         numeric(14,2) not null,
  currency       char(3) not null,
  status         text not null default 'upcoming' check (status in ('upcoming','paid','skipped')),
  paid_on        date,
  paid_amount    numeric(14,2),
  paid_at        timestamptz,
  snoozed_until  timestamptz,
  created_at     timestamptz not null default now(),
  unique (reminder_id, due_date),
  check ((status = 'paid') = (paid_at is not null))
);
create index occurrences_user_due on public.occurrences (user_id, due_date);
create index occurrences_user_status on public.occurrences (user_id, status, due_date);

-- ───────── expenses / budgets / goals ─────────
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  category_id uuid references public.categories(id) on delete set null,
  amount numeric(14,2) not null check (amount > 0),
  currency char(3) not null default 'HUF' check (currency ~ '^[A-Z]{3}$'),
  spent_on date not null default current_date,
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);
create index expenses_user_date on public.expenses (user_id, spent_on);

create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  monthly_limit numeric(14,2) not null check (monthly_limit > 0),
  currency char(3) not null default 'HUF' check (currency ~ '^[A-Z]{3}$'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id, category_id)
);
create trigger budgets_updated before update on public.budgets for each row execute function public.set_updated_at();

create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null check (char_length(name) between 1 and 60),
  target_amount numeric(14,2) not null check (target_amount > 0),
  currency char(3) not null default 'HUF' check (currency ~ '^[A-Z]{3}$'),
  target_date date,
  icon text not null default 'piggy-bank',
  color_slot smallint not null default 1 check (color_slot between 1 and 7),
  archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index savings_goals_user on public.savings_goals (user_id);
create trigger savings_goals_updated before update on public.savings_goals for each row execute function public.set_updated_at();

create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.savings_goals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  amount numeric(14,2) not null check (amount <> 0),
  contributed_on date not null default current_date,
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);
create index goal_contributions_goal on public.goal_contributions (goal_id);

-- ───────── push_subscriptions ─────────
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  endpoint text not null unique
    check (endpoint ~ '^https://([a-z0-9-]+\.)*(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)(:[0-9]+)?/'),
  p256dh text not null, auth text not null,
  platform text check (platform in ('ios','android','windows','macos','linux','other')),
  user_agent text check (char_length(user_agent) <= 400), label text check (char_length(label) <= 80),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_success_at timestamptz,
  failed_count smallint not null default 0,
  disabled_at timestamptz
);
create index push_subscriptions_user on public.push_subscriptions (user_id) where disabled_at is null;

-- ───────── notifications ─────────
create table public.notifications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  kind           text not null check (kind in ('reminder','overdue','trial_end','digest','tip','news','system')),
  channel        text not null check (channel in ('push','email','in_app')),
  reminder_id    uuid references public.reminders(id) on delete cascade,
  occurrence_id  uuid references public.occurrences(id) on delete cascade,
  payload        jsonb not null default '{}',
  scheduled_for  timestamptz not null,
  status         text not null default 'pending' check (status in ('pending','sending','sent','failed','expired','cancelled')),
  attempts       smallint not null default 0,
  claimed_at     timestamptz,
  next_attempt_at timestamptz,
  last_error     text,
  sent_at        timestamptz,
  read_at        timestamptz,
  dedupe_key     text not null unique,
  created_at     timestamptz not null default now()
);
create index notifications_due on public.notifications (scheduled_for) where status in ('pending','failed','sending');
create index notifications_inbox on public.notifications (user_id, scheduled_for desc) where channel = 'in_app';
create index notifications_occ on public.notifications (occurrence_id);
create index notifications_reminder on public.notifications (reminder_id);

-- ───────── fx / tips / news ─────────
create table public.fx_rates (
  as_of date not null, currency char(3) not null, per_eur numeric(18,8) not null check (per_eur > 0),
  primary key (as_of, currency)
);

create table public.tips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  severity text not null default 'info' check (severity in ('info','save','warn')),
  params jsonb not null default '{}',
  est_monthly_saving numeric(14,2),
  reminder_ids uuid[] not null default '{}',
  fingerprint text not null,
  status text not null default 'new' check (status in ('new','seen','dismissed','snoozed','done')),
  snoozed_until date,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (user_id, fingerprint)
);
create trigger tips_updated before update on public.tips for each row execute function public.set_updated_at();

create table public.news_sources (
  key text primary key, name text not null, feed_url text not null, home_url text not null,
  topic_hint text check (topic_hint in ('deals','utilities','banking','saving','prices','general')),
  enabled boolean not null default true,
  etag text, last_modified text, last_fetched_at timestamptz, last_status int, last_error text,
  license_note text
);

create table public.news_items (
  id uuid primary key default gen_random_uuid(),
  source_key text not null references public.news_sources(key) on delete cascade,
  url text not null unique,
  title text not null check (char_length(title) <= 300),
  snippet text check (char_length(snippet) <= 400),
  image_url text check (image_url ~ '^https://'),
  topic text not null check (topic in ('deals','utilities','banking','saving','prices','general')),
  score smallint not null default 0,
  published_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  is_hidden boolean not null default false
);
create index news_items_feed on public.news_items (topic, published_at desc) where not is_hidden;
create index news_items_expires on public.news_items (expires_at);

create table public.news_reports (
  id uuid primary key default gen_random_uuid(),
  news_id uuid not null references public.news_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  reason text not null check (reason in ('outdated','wrong','spam','other')),
  created_at timestamptz not null default now(),
  unique (news_id, user_id)
);

-- ═════════ RLS ═════════
alter table public.profiles           enable row level security;
alter table public.categories         enable row level security;
alter table public.service_catalog    enable row level security;
alter table public.reminders          enable row level security;
alter table public.occurrences        enable row level security;
alter table public.expenses           enable row level security;
alter table public.budgets            enable row level security;
alter table public.savings_goals      enable row level security;
alter table public.goal_contributions enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notifications      enable row level security;
alter table public.fx_rates           enable row level security;
alter table public.tips               enable row level security;
alter table public.news_sources       enable row level security;
alter table public.news_items         enable row level security;
alter table public.news_reports       enable row level security;

-- profiles
create policy profiles_select on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_update on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- categories (rendszer: olvasható; saját: CRUD, key nélkül)
create policy categories_select on public.categories for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));
create policy categories_insert on public.categories for insert to authenticated
  with check (user_id = (select auth.uid()) and key is null);
create policy categories_update on public.categories for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and key is null);
create policy categories_delete on public.categories for delete to authenticated
  using (user_id = (select auth.uid()));

-- referencia-adat
create policy catalog_select on public.service_catalog for select to authenticated using (is_active);
create policy fx_select on public.fx_rates for select to authenticated using (true);

-- reminders
create policy reminders_select on public.reminders for select to authenticated using ((select auth.uid()) = user_id);
create policy reminders_insert on public.reminders for insert to authenticated
  with check ((select auth.uid()) = user_id
    and (category_id is null or exists (select 1 from public.categories c where c.id = category_id)));
create policy reminders_update on public.reminders for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id
    and (category_id is null or exists (select 1 from public.categories c where c.id = category_id)));
create policy reminders_delete on public.reminders for delete to authenticated using ((select auth.uid()) = user_id);

-- occurrences: csak olvasás (írás: security definer RPC)
create policy occurrences_select on public.occurrences for select to authenticated using ((select auth.uid()) = user_id);

-- expenses
create policy expenses_select on public.expenses for select to authenticated using ((select auth.uid()) = user_id);
create policy expenses_insert on public.expenses for insert to authenticated
  with check ((select auth.uid()) = user_id
    and (category_id is null or exists (select 1 from public.categories c where c.id = category_id)));
create policy expenses_update on public.expenses for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id
    and (category_id is null or exists (select 1 from public.categories c where c.id = category_id)));
create policy expenses_delete on public.expenses for delete to authenticated using ((select auth.uid()) = user_id);

-- budgets
create policy budgets_select on public.budgets for select to authenticated using ((select auth.uid()) = user_id);
create policy budgets_insert on public.budgets for insert to authenticated
  with check ((select auth.uid()) = user_id and exists (select 1 from public.categories c where c.id = category_id));
create policy budgets_update on public.budgets for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and exists (select 1 from public.categories c where c.id = category_id));
create policy budgets_delete on public.budgets for delete to authenticated using ((select auth.uid()) = user_id);

-- savings goals + contributions
create policy goals_select on public.savings_goals for select to authenticated using ((select auth.uid()) = user_id);
create policy goals_insert on public.savings_goals for insert to authenticated with check ((select auth.uid()) = user_id);
create policy goals_update on public.savings_goals for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy goals_delete on public.savings_goals for delete to authenticated using ((select auth.uid()) = user_id);

create policy contrib_select on public.goal_contributions for select to authenticated using ((select auth.uid()) = user_id);
create policy contrib_insert on public.goal_contributions for insert to authenticated
  with check ((select auth.uid()) = user_id
    and exists (select 1 from public.savings_goals g where g.id = goal_id and g.user_id = (select auth.uid())));
create policy contrib_update on public.goal_contributions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id
    and exists (select 1 from public.savings_goals g where g.id = goal_id and g.user_id = (select auth.uid())));
create policy contrib_delete on public.goal_contributions for delete to authenticated using ((select auth.uid()) = user_id);

-- push_subscriptions: olvasás/törlés saját; létrehozás RPC-n át
create policy push_select on public.push_subscriptions for select to authenticated using ((select auth.uid()) = user_id);
create policy push_delete on public.push_subscriptions for delete to authenticated using ((select auth.uid()) = user_id);

-- notifications: csak a saját, már esedékes in_app sorok; csak read_at módosítható (oszlop-jog)
create policy notif_select on public.notifications for select to authenticated
  using ((select auth.uid()) = user_id and channel = 'in_app' and scheduled_for <= now());
create policy notif_update on public.notifications for update to authenticated
  using ((select auth.uid()) = user_id and channel = 'in_app')
  with check ((select auth.uid()) = user_id and channel = 'in_app');

-- tips: olvasás saját; módosítás RPC-n át
create policy tips_select on public.tips for select to authenticated using ((select auth.uid()) = user_id);

-- news
create policy news_select on public.news_items for select to authenticated
  using (not is_hidden and expires_at > now());
create policy news_reports_select on public.news_reports for select to authenticated using ((select auth.uid()) = user_id);
create policy news_reports_insert on public.news_reports for insert to authenticated with check ((select auth.uid()) = user_id);
-- news_sources: nincs policy → authenticated/anon nem éri el (csak service_role)

-- ═════════ jogosultságok (a Supabase alapból mindent ad → szűkítünk) ═════════
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

revoke all on public.news_sources from authenticated;
revoke insert, update, delete, truncate on public.service_catalog, public.fx_rates, public.news_items from authenticated;
revoke insert, update, delete, truncate on public.occurrences, public.tips from authenticated;
revoke insert, update, truncate on public.push_subscriptions from authenticated;
revoke insert, delete, truncate on public.notifications from authenticated;
revoke insert, delete, truncate on public.profiles from authenticated;
revoke update, delete, truncate on public.news_reports from authenticated;
revoke truncate on all tables in schema public from authenticated;

revoke update on public.profiles from authenticated;
grant update (display_name, avatar_path, locale, theme, base_currency, timezone, reminders_enabled,
              default_offsets, default_notify_time, channel_push, channel_email, notify_hide_details,
              weekly_digest, tips_enabled, news_enabled, monthly_income, onboarding_done)
  on public.profiles to authenticated;

revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ═════════ Storage: avatars ═════════
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/webp','image/jpeg','image/png'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
