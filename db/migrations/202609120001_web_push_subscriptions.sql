create table web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  household_member_id uuid not null references household_members(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_name text not null default '',
  enabled boolean not null default true,
  last_registered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index web_push_subscriptions_household_member_idx
on web_push_subscriptions (household_id, household_member_id)
where enabled = true;

create index web_push_subscriptions_user_idx
on web_push_subscriptions (user_id);

create trigger web_push_subscriptions_set_updated_at
before update on web_push_subscriptions
for each row execute function set_updated_at();
