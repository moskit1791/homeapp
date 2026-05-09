create table notification_preferences (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  household_member_id uuid not null references household_members(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'finance.changed',
      'finance.month.generated',
      'finance.month.deleted',
      'meal.changed',
      'calendar.changed',
      'todo.changed',
      'note.changed',
      'shopping.changed',
      'cleaning.changed',
      'annual_cost.changed',
      'data.changed',
      'attachment.changed',
      'permissions.changed',
      'household.changed'
    )
  ),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_member_id, event_type)
);

create index notification_preferences_household_member_idx
on notification_preferences (household_id, household_member_id);

create trigger notification_preferences_set_updated_at
before update on notification_preferences
for each row execute function set_updated_at();
