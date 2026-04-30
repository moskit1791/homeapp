create extension if not exists citext;
create extension if not exists pgcrypto;

create type account_status as enum ('inactive', 'active', 'banned');
create type household_member_role as enum ('owner', 'member');
create type module_key as enum (
  'start',
  'finances',
  'meal_planner',
  'calendar',
  'todo',
  'notes',
  'shopping',
  'cleaning',
  'annual_costs',
  'data_entries',
  'attachments',
  'household_members',
  'permissions'
);
create type scope_type as enum ('household', 'member');
create type todo_status as enum ('todo', 'done');
create type shopping_list_type as enum ('daily', 'long_term');
create type cleaning_frequency_mode as enum ('preset', 'custom_days');

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  currency_code char(3) not null default 'PLN',
  week_starts_on smallint not null default 1 check (week_starts_on = 1),
  meal_slots_per_day integer not null default 3 check (meal_slots_per_day > 0 and meal_slots_per_day <= 8),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger households_set_updated_at
before update on households
for each row execute function set_updated_at();

create table users (
  id uuid primary key default gen_random_uuid(),
  auth_provider_user_id uuid not null unique,
  email citext not null unique,
  display_name text not null check (length(trim(display_name)) > 0),
  account_status account_status not null default 'inactive',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger users_set_updated_at
before update on users
for each row execute function set_updated_at();

create table household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role household_member_role not null default 'member',
  is_active boolean not null default true,
  joined_at timestamptz not null default now(),
  removed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((is_active = true and removed_at is null) or (is_active = false))
);

create unique index household_members_one_active_household_per_user
on household_members (user_id)
where is_active = true;

create unique index household_members_one_owner_per_household
on household_members (household_id)
where is_active = true and role = 'owner';

create index household_members_household_id_idx on household_members (household_id);

create trigger household_members_set_updated_at
before update on household_members
for each row execute function set_updated_at();

create table member_permissions (
  id uuid primary key default gen_random_uuid(),
  household_member_id uuid not null references household_members(id) on delete cascade,
  module_key module_key not null,
  can_read boolean not null default false,
  can_create boolean not null default false,
  can_update boolean not null default false,
  can_delete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_member_id, module_key),
  check (can_read = true or (can_create = false and can_update = false and can_delete = false))
);

create trigger member_permissions_set_updated_at
before update on member_permissions
for each row execute function set_updated_at();

create table invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  email citext not null,
  invited_by_user_id uuid not null references users(id) on delete restrict,
  token text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index invitations_household_id_idx on invitations (household_id);

create trigger invitations_set_updated_at
before update on invitations
for each row execute function set_updated_at();

create table budget_months (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  year integer not null check (year between 2000 and 2200),
  month integer not null check (month between 1 and 12),
  source_budget_month_id uuid null references budget_months(id) on delete set null,
  is_current boolean not null default false,
  generated_at timestamptz not null default now(),
  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, year, month)
);

create unique index budget_months_one_current_per_household
on budget_months (household_id)
where is_current = true;

create index budget_months_household_id_idx on budget_months (household_id);

create trigger budget_months_set_updated_at
before update on budget_months
for each row execute function set_updated_at();

create table budget_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  display_order integer not null default 0 check (display_order >= 0),
  copy_budget_to_next_month boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, name)
);

create index budget_categories_household_id_idx on budget_categories (household_id);

create trigger budget_categories_set_updated_at
before update on budget_categories
for each row execute function set_updated_at();

create table budget_items (
  id uuid primary key default gen_random_uuid(),
  budget_month_id uuid not null references budget_months(id) on delete cascade,
  owner_member_id uuid not null references household_members(id) on delete restrict,
  category_id uuid not null references budget_categories(id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  budget_amount numeric(12, 2) null check (budget_amount is null or budget_amount >= 0),
  display_order integer not null default 0 check (display_order >= 0),
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index budget_items_budget_month_id_idx on budget_items (budget_month_id);
create index budget_items_owner_member_id_idx on budget_items (owner_member_id);
create index budget_items_category_id_idx on budget_items (category_id);

create trigger budget_items_set_updated_at
before update on budget_items
for each row execute function set_updated_at();

create table expenses (
  id uuid primary key default gen_random_uuid(),
  budget_item_id uuid not null references budget_items(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expenses_budget_item_id_idx on expenses (budget_item_id);

create trigger expenses_set_updated_at
before update on expenses
for each row execute function set_updated_at();

create table monthly_incomes (
  id uuid primary key default gen_random_uuid(),
  budget_month_id uuid not null references budget_months(id) on delete cascade,
  owner_member_id uuid not null references household_members(id) on delete restrict,
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (budget_month_id, owner_member_id)
);

create index monthly_incomes_budget_month_id_idx on monthly_incomes (budget_month_id);

create trigger monthly_incomes_set_updated_at
before update on monthly_incomes
for each row execute function set_updated_at();

create table meal_plan_weeks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  week_start_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, week_start_date)
);

create index meal_plan_weeks_household_id_idx on meal_plan_weeks (household_id);

create trigger meal_plan_weeks_set_updated_at
before update on meal_plan_weeks
for each row execute function set_updated_at();

create table meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  meal_plan_week_id uuid not null references meal_plan_weeks(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  slot_index integer not null check (slot_index >= 0),
  meal_name text not null check (length(trim(meal_name)) > 0),
  link_url text null,
  note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meal_plan_week_id, weekday, slot_index)
);

create index meal_plan_entries_week_id_idx on meal_plan_entries (meal_plan_week_id);

create trigger meal_plan_entries_set_updated_at
before update on meal_plan_entries
for each row execute function set_updated_at();

create table meal_ideas (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  note text null,
  link_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index meal_ideas_household_id_idx on meal_ideas (household_id);

create trigger meal_ideas_set_updated_at
before update on meal_ideas
for each row execute function set_updated_at();

create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  scope_type scope_type not null,
  owner_member_id uuid null references household_members(id) on delete set null,
  title text not null check (length(trim(title)) > 0),
  event_date date not null,
  event_time time null,
  note text null,
  recurrence_rule text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scope_type = 'household' and owner_member_id is null) or (scope_type = 'member' and owner_member_id is not null))
);

create index calendar_events_household_date_idx on calendar_events (household_id, event_date);

create trigger calendar_events_set_updated_at
before update on calendar_events
for each row execute function set_updated_at();

create table todo_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  scope_type scope_type not null,
  owner_member_id uuid null references household_members(id) on delete set null,
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  status todo_status not null default 'todo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scope_type = 'household' and owner_member_id is null) or (scope_type = 'member' and owner_member_id is not null))
);

create index todo_items_household_status_idx on todo_items (household_id, status);

create trigger todo_items_set_updated_at
before update on todo_items
for each row execute function set_updated_at();

create table note_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index note_items_household_id_idx on note_items (household_id);

create trigger note_items_set_updated_at
before update on note_items
for each row execute function set_updated_at();

create table shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  type shopping_list_type not null,
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, type)
);

create index shopping_lists_household_id_idx on shopping_lists (household_id);

create trigger shopping_lists_set_updated_at
before update on shopping_lists
for each row execute function set_updated_at();

create table shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  shopping_list_id uuid not null references shopping_lists(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  quantity text not null default '',
  is_checked boolean not null default false,
  checked_at timestamptz null,
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((is_checked = false and checked_at is null) or (is_checked = true and checked_at is not null))
);

create index shopping_list_items_sort_idx on shopping_list_items (shopping_list_id, is_checked, display_order, checked_at);

create trigger shopping_list_items_set_updated_at
before update on shopping_list_items
for each row execute function set_updated_at();

create table cleaning_tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  frequency_mode cleaning_frequency_mode not null,
  frequency_days integer not null check (frequency_days > 0),
  completion_window_days integer not null default 0 check (completion_window_days >= 0),
  next_due_at date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cleaning_tasks_household_due_idx on cleaning_tasks (household_id, next_due_at);

create trigger cleaning_tasks_set_updated_at
before update on cleaning_tasks
for each row execute function set_updated_at();

create table cleaning_task_history (
  id uuid primary key default gen_random_uuid(),
  cleaning_task_id uuid not null references cleaning_tasks(id) on delete cascade,
  completed_at date not null,
  completed_by_member_id uuid null references household_members(id) on delete set null,
  created_at timestamptz not null default now()
);

create index cleaning_task_history_task_id_idx on cleaning_task_history (cleaning_task_id, completed_at desc);

create table annual_costs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  default_amount numeric(12, 2) null check (default_amount is null or default_amount >= 0),
  next_due_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index annual_costs_household_due_idx on annual_costs (household_id, next_due_date);

create trigger annual_costs_set_updated_at
before update on annual_costs
for each row execute function set_updated_at();

create table annual_cost_history (
  id uuid primary key default gen_random_uuid(),
  annual_cost_id uuid not null references annual_costs(id) on delete cascade,
  executed_at date not null,
  amount numeric(12, 2) null check (amount is null or amount >= 0),
  created_at timestamptz not null default now()
);

create index annual_cost_history_cost_id_idx on annual_cost_history (annual_cost_id, executed_at desc);

create table data_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index data_entries_household_updated_idx on data_entries (household_id, updated_at desc);
create index data_entries_search_idx on data_entries using gin (to_tsvector('simple', title || ' ' || value));

create trigger data_entries_set_updated_at
before update on data_entries
for each row execute function set_updated_at();

create table attachments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  file_name text not null check (length(trim(file_name)) > 0),
  caption text not null default '',
  created_by_member_id uuid null references household_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index attachments_household_created_idx on attachments (household_id, created_at desc);
create index attachments_caption_idx on attachments using gin (to_tsvector('simple', caption));

create trigger attachments_set_updated_at
before update on attachments
for each row execute function set_updated_at();

create view v_budget_item_totals as
select
  bi.id as budget_item_id,
  coalesce(sum(e.amount), 0)::numeric(12, 2) as spent_amount,
  case
    when bi.budget_amount is null then null
    else (bi.budget_amount - coalesce(sum(e.amount), 0))::numeric(12, 2)
  end as remaining_amount
from budget_items bi
left join expenses e on e.budget_item_id = bi.id
group by bi.id, bi.budget_amount;

create view v_budget_person_summary as
select
  bm.id as budget_month_id,
  hm.id as owner_member_id,
  coalesce(mi.amount, 0)::numeric(12, 2) as income_amount,
  coalesce(sum(coalesce(bi.budget_amount, 0)), 0)::numeric(12, 2) as total_budget_amount,
  coalesce(sum(bit.spent_amount), 0)::numeric(12, 2) as total_spent_amount,
  coalesce(
    sum(coalesce(bi.budget_amount, 0) - coalesce(bit.spent_amount, 0)),
    0
  )::numeric(12, 2) as total_remaining_amount
from budget_months bm
join household_members hm on hm.household_id = bm.household_id and hm.is_active = true
left join monthly_incomes mi on mi.budget_month_id = bm.id and mi.owner_member_id = hm.id
left join budget_items bi on bi.budget_month_id = bm.id and bi.owner_member_id = hm.id and bi.is_deleted = false
left join v_budget_item_totals bit on bit.budget_item_id = bi.id
group by bm.id, hm.id, mi.amount;

create view v_cleaning_overview as
select
  id as cleaning_task_id,
  (next_due_at < current_date) as is_overdue,
  next_due_at
from cleaning_tasks;

create view v_annual_cost_history_by_year as
select
  annual_cost_id,
  extract(year from executed_at)::integer as executed_year,
  coalesce(sum(amount), 0)::numeric(12, 2) as total_amount
from annual_cost_history
group by annual_cost_id, extract(year from executed_at);
