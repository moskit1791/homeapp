create table finance_debts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  lender_name text not null check (length(trim(lender_name)) > 0),
  purpose text not null check (length(trim(purpose)) > 0),
  amount numeric(12,2) not null check (amount > 0),
  due_date date null,
  note text null,
  is_settled boolean not null default false,
  settled_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((is_settled = false and settled_at is null) or (is_settled = true))
);

create index finance_debts_household_open_idx
on finance_debts (household_id, is_settled, due_date, created_at);

create trigger finance_debts_set_updated_at
before update on finance_debts
for each row execute function set_updated_at();
