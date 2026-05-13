alter table note_items
add column owner_member_id uuid;

update note_items ni
set owner_member_id = (
  select hm.id
  from household_members hm
  where hm.household_id = ni.household_id
    and hm.is_active = true
  order by
    case when hm.role = 'owner' then 0 else 1 end,
    hm.created_at asc
  limit 1
)
where ni.owner_member_id is null;

delete from note_items
where owner_member_id is null;

alter table note_items
alter column owner_member_id set not null;

alter table note_items
add constraint note_items_owner_member_id_fkey
foreign key (owner_member_id) references household_members(id) on delete cascade;

create index note_items_household_owner_updated_idx
on note_items (household_id, owner_member_id, updated_at desc);

update todo_items
set
  scope_type = 'household',
  owner_member_id = null
where scope_type <> 'household'
  or owner_member_id is not null;
