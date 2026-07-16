create table if not exists budget_month_category_orders (
  budget_month_id uuid not null references budget_months(id) on delete cascade,
  category_id uuid not null references budget_categories(id) on delete cascade,
  display_order integer not null check (display_order >= 0),
  primary key (budget_month_id, category_id)
);

create index if not exists budget_month_category_orders_category_idx
on budget_month_category_orders (category_id, budget_month_id);

insert into budget_month_category_orders (
  budget_month_id,
  category_id,
  display_order
)
select distinct
  bi.budget_month_id,
  bi.category_id,
  bc.display_order
from budget_items bi
join budget_categories bc on bc.id = bi.category_id
on conflict (budget_month_id, category_id) do nothing;
