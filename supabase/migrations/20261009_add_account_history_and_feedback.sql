-- Run this migration in the Supabase SQL Editor before deploying these features.

create table if not exists public.search_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  searched_at timestamptz not null default now(),
  search_data jsonb not null,
  offers jsonb not null default '[]'::jsonb,
  checked_pairs integer not null default 0 check (checked_pairs >= 0),
  total_pairs integer not null default 0 check (total_pairs >= 0),
  primary key (user_id, id)
);

create index if not exists search_history_user_recent_idx
  on public.search_history (user_id, searched_at desc);

alter table public.search_history enable row level security;
drop policy if exists "Users can read their own search history" on public.search_history;
drop policy if exists "Users can add their own search history" on public.search_history;
drop policy if exists "Users can update their own search history" on public.search_history;
drop policy if exists "Users can delete their own search history" on public.search_history;
create policy "Users can read their own search history"
  on public.search_history for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users can add their own search history"
  on public.search_history for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users can update their own search history"
  on public.search_history for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users can delete their own search history"
  on public.search_history for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Feedback is intentionally a public board. The app stores no submitter email or IP.
create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('Idea', 'Something is broken', 'Other')),
  message text not null check (char_length(message) between 5 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists user_feedback_recent_idx
  on public.user_feedback (created_at desc);

alter table public.user_feedback enable row level security;
drop policy if exists "Anyone can read public feedback" on public.user_feedback;
drop policy if exists "Anyone can submit public feedback" on public.user_feedback;
create policy "Anyone can read public feedback"
  on public.user_feedback for select to anon, authenticated
  using (true);
create policy "Anyone can submit public feedback"
  on public.user_feedback for insert to anon, authenticated
  with check (category in ('Idea', 'Something is broken', 'Other') and char_length(message) between 5 and 2000);
