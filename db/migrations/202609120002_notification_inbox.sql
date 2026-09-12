create table notification_inbox (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  household_member_id uuid not null references household_members(id) on delete cascade,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notification_inbox_member_created_idx
on notification_inbox (household_id, household_member_id, created_at desc);

create index notification_inbox_member_unread_idx
on notification_inbox (household_id, household_member_id, created_at desc)
where read_at is null;
