-- Run this once in the Supabase SQL Editor to enable account-backed saved searches.
create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  origin text not null,
  destination text not null,
  date_from date not null,
  date_to date not null,
  min_nights integer not null default 3 check (min_nights between 1 and 240),
  max_nights integer not null default 10 check (max_nights between min_nights and 240),
  travellers integer not null default 1 check (travellers between 1 and 9),
  price_alert_enabled boolean not null default true,
  target_price numeric(10,2),
  last_checked_at timestamptz,
  last_notified_price numeric(10,2),
  created_at timestamptz not null default now()
);

-- Keep the original column names for existing accounts; values are inclusive
-- trip days (departure day counts as day 1), up to eight 30-day months.
alter table public.saved_searches drop constraint if exists saved_searches_min_nights_check;
alter table public.saved_searches drop constraint if exists saved_searches_max_nights_check;
alter table public.saved_searches drop constraint if exists saved_searches_trip_days_min_check;
alter table public.saved_searches drop constraint if exists saved_searches_trip_days_max_check;
alter table public.saved_searches
  add constraint saved_searches_trip_days_min_check check (min_nights between 1 and 240),
  add constraint saved_searches_trip_days_max_check check (max_nights between min_nights and 240);

comment on column public.saved_searches.min_nights is 'Minimum inclusive trip days; legacy column name retained.';
comment on column public.saved_searches.max_nights is 'Maximum inclusive trip days; legacy column name retained.';

-- BYOK deployment: users' SerpApi keys are encrypted by the server and never
-- exposed through the browser's Supabase client. Only the service role accesses this table.
create table if not exists public.user_serpapi_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_key text not null,
  updated_at timestamptz not null default now()
);

alter table public.user_serpapi_keys enable row level security;

create index if not exists saved_searches_user_created_idx
  on public.saved_searches (user_id, created_at desc);

alter table public.saved_searches enable row level security;

create policy "Users can view their own saved searches"
  on public.saved_searches for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can save their own searches"
  on public.saved_searches for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own saved searches"
  on public.saved_searches for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own saved searches"
  on public.saved_searches for delete to authenticated
  using ((select auth.uid()) = user_id);
