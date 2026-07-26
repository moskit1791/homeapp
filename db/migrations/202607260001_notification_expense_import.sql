alter table expenses
  add column if not exists household_id uuid null references households(id) on delete cascade,
  add column if not exists name text null,
  add column if not exists source text null,
  add column if not exists source_external_id uuid null,
  add column if not exists occurred_at timestamptz null,
  add column if not exists original_amount numeric(12, 2) null,
  add column if not exists original_currency varchar(3) null;

alter table expenses
  drop constraint if exists expenses_source_check;

alter table expenses
  add constraint expenses_source_check
  check (source is null or source in ('manual', 'bank_notification'));

alter table expenses
  drop constraint if exists expenses_original_amount_check;

alter table expenses
  add constraint expenses_original_amount_check
  check (original_amount is null or original_amount > 0);

alter table expenses
  drop constraint if exists expenses_original_currency_check;

alter table expenses
  add constraint expenses_original_currency_check
  check (
    original_currency is null
    or original_currency ~ '^[A-Z]{3}$'
  );

create table if not exists expense_notification_imports (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  source_external_id uuid not null,
  expense_id uuid null unique references expenses(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (household_id, source_external_id)
);

create index if not exists expense_notification_imports_household_created_at_idx
  on expense_notification_imports (household_id, created_at desc);
