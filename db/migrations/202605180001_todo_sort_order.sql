alter table todo_items
add column sort_order integer;

with ranked as (
  select
    id,
    row_number() over (
      partition by household_id
      order by status asc, created_at desc, id asc
    ) * 1000 as next_sort_order
  from todo_items
)
update todo_items ti
set sort_order = ranked.next_sort_order
from ranked
where ranked.id = ti.id;

alter table todo_items
alter column sort_order set not null,
alter column sort_order set default 0;

create index todo_items_household_status_sort_idx
on todo_items (household_id, status, sort_order asc, created_at desc);
