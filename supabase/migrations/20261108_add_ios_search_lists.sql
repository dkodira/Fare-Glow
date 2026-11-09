create table if not exists public.ios_saved_searches (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  created_at timestamptz not null default now(),
  search_data jsonb not null,
  primary key (user_id, id)
);

create index if not exists ios_saved_searches_user_created_idx
  on public.ios_saved_searches (user_id, created_at desc);

alter table public.ios_saved_searches enable row level security;
grant select, insert, update, delete on public.ios_saved_searches to authenticated;

drop policy if exists "Users can read their iPhone saved searches" on public.ios_saved_searches;
create policy "Users can read their iPhone saved searches"
  on public.ios_saved_searches for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their iPhone saved searches" on public.ios_saved_searches;
create policy "Users can create their iPhone saved searches"
  on public.ios_saved_searches for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their iPhone saved searches" on public.ios_saved_searches;
create policy "Users can update their iPhone saved searches"
  on public.ios_saved_searches for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their iPhone saved searches" on public.ios_saved_searches;
create policy "Users can delete their iPhone saved searches"
  on public.ios_saved_searches for delete to authenticated
  using (auth.uid() = user_id);

create table if not exists public.ios_search_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  searched_at timestamptz not null default now(),
  search_data jsonb not null,
  offers jsonb not null default '[]'::jsonb,
  checked_pairs integer not null default 0 check (checked_pairs >= 0),
  total_pairs integer not null default 0 check (total_pairs >= 0),
  primary key (user_id, id)
);

create index if not exists ios_search_history_user_searched_idx
  on public.ios_search_history (user_id, searched_at desc);

alter table public.ios_search_history enable row level security;
grant select, insert, update, delete on public.ios_search_history to authenticated;

drop policy if exists "Users can read their iPhone search history" on public.ios_search_history;
create policy "Users can read their iPhone search history"
  on public.ios_search_history for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their iPhone search history" on public.ios_search_history;
create policy "Users can create their iPhone search history"
  on public.ios_search_history for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their iPhone search history" on public.ios_search_history;
create policy "Users can update their iPhone search history"
  on public.ios_search_history for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their iPhone search history" on public.ios_search_history;
create policy "Users can delete their iPhone search history"
  on public.ios_search_history for delete to authenticated
  using (auth.uid() = user_id);
