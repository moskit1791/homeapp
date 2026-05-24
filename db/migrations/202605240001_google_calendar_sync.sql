create table calendar_google_connections (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  household_member_id uuid not null references household_members(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  google_account_email text null,
  google_calendar_id text not null default 'primary',
  refresh_token_ciphertext text not null,
  scope text not null,
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_member_id)
);

create index calendar_google_connections_household_idx
on calendar_google_connections (household_id);

create trigger calendar_google_connections_set_updated_at
before update on calendar_google_connections
for each row execute function set_updated_at();

create table calendar_google_event_mappings (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references calendar_google_connections(id) on delete cascade,
  google_event_id text not null,
  calendar_event_id uuid not null references calendar_events(id) on delete cascade,
  google_updated_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, google_event_id),
  unique (calendar_event_id)
);

create trigger calendar_google_event_mappings_set_updated_at
before update on calendar_google_event_mappings
for each row execute function set_updated_at();
