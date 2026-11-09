alter table public.saved_searches
  add column if not exists destinations text[] not null default '{}';

update public.saved_searches
set destinations = array[destination]
where cardinality(destinations) = 0
  and destination is not null
  and btrim(destination) <> '';

comment on column public.saved_searches.destinations is
  'Selected destination airport labels for fare comparison; destination remains the legacy first destination.';
