create table push_tokens (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  household_member_id uuid not null references household_members(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('android', 'ios', 'web', 'unknown')),
  device_name text not null default '',
  enabled boolean not null default true,
  last_registered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_tokens_household_member_idx
on push_tokens (household_id, household_member_id)
where enabled = true;

create index push_tokens_user_idx on push_tokens (user_id);

create trigger push_tokens_set_updated_at
before update on push_tokens
for each row execute function set_updated_at();
