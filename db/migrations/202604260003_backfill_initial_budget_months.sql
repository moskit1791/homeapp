insert into budget_months (
  household_id,
  year,
  month,
  is_current
)
select
  h.id,
  extract(year from current_date)::integer,
  extract(month from current_date)::integer,
  true
from households h
where not exists (
  select 1
  from budget_months bm
  where bm.household_id = h.id
);

with latest_month as (
  select distinct on (bm.household_id)
    bm.id,
    bm.household_id
  from budget_months bm
  where not exists (
    select 1
    from budget_months current_bm
    where current_bm.household_id = bm.household_id
      and current_bm.is_current = true
  )
  order by bm.household_id, bm.year desc, bm.month desc
)
update budget_months bm
set is_current = true
from latest_month lm
where bm.id = lm.id;

insert into monthly_incomes (
  budget_month_id,
  owner_member_id,
  amount
)
select
  bm.id,
  hm.id,
  0
from budget_months bm
join household_members hm on hm.household_id = bm.household_id
where bm.is_current = true
  and hm.is_active = true
on conflict (budget_month_id, owner_member_id) do nothing;
