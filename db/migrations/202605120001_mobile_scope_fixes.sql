alter type shopping_list_type add value if not exists 'tomorrow';

alter table calendar_events
  add column if not exists reminder_offset_minutes integer null
    check (reminder_offset_minutes is null or reminder_offset_minutes in (15, 60, 1440)),
  add column if not exists reminder_sent_at timestamptz null;

create index if not exists calendar_events_reminder_due_idx
on calendar_events (event_date, event_time, reminder_offset_minutes, reminder_sent_at)
where reminder_offset_minutes is not null and reminder_sent_at is null;

create table if not exists shopping_rollovers (
  household_id uuid primary key references households(id) on delete cascade,
  last_rollover_date date not null default (timezone('Europe/Warsaw', now())::date),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger shopping_rollovers_set_updated_at
before update on shopping_rollovers
for each row execute function set_updated_at();

insert into shopping_rollovers (household_id, last_rollover_date)
select h.id, timezone('Europe/Warsaw', now())::date
from households h
on conflict (household_id) do nothing;

update shopping_lists
set name = 'Dzisiaj'
where type = 'daily'
  and name in ('Codzienne', 'Zakupy na dziś');

update shopping_lists
set name = 'Na później'
where type = 'long_term'
  and name in ('Długoterminowe', 'Rzeczy na później');
