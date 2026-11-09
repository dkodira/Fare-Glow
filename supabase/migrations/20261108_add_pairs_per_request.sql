-- Preserve existing saved searches and default them to the current batch size.
alter table public.saved_searches
  add column if not exists pairs_per_request integer not null default 8;

alter table public.saved_searches
  drop constraint if exists saved_searches_pairs_per_request_check;

alter table public.saved_searches
  add constraint saved_searches_pairs_per_request_check
  check (pairs_per_request between 1 and 250);

comment on column public.saved_searches.pairs_per_request is
  'Date pairs requested by each search action; values above 8 require the signed-in user’s saved personal SerpApi key.';
