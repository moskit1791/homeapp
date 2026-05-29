alter table calendar_events
  add column if not exists location_name text null check (location_name is null or length(trim(location_name)) <= 500),
  add column if not exists location_url text null check (location_url is null or length(trim(location_url)) <= 1000);

with default_categories(name, display_order) as (
  values
    ('Auto i transport', 0),
    ('Jedzenie', 1),
    ('Kieszonkowe', 2),
    ('Rachunki i media', 3),
    ('Zobowiązania', 4),
    ('Remont', 5),
    ('Oszczędności', 6),
    ('Dzieci', 7),
    ('Różne', 8),
    ('Subskrypcje i usługi cyfrowe', 9),
    ('Prezenty i okazje', 10),
    ('Rozrywka', 11),
    ('Zdrowie i uroda', 12),
    ('Dom i środki czystości', 13)
)
insert into budget_categories (
  household_id,
  name,
  display_order,
  copy_budget_to_next_month,
  is_active
)
select
  h.id,
  dc.name,
  dc.display_order,
  false,
  true
from households h
cross join default_categories dc
on conflict (household_id, name) do update
set
  is_active = true,
  updated_at = now();
