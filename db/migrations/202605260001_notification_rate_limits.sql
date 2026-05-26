create table notification_delivery_rate_limits (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  event_type text not null,
  last_sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (household_id, event_type)
);

create index notification_delivery_rate_limits_household_idx
on notification_delivery_rate_limits (household_id, event_type, last_sent_at);
