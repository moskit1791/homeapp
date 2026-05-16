create table finance_savings_accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  current_amount numeric(12, 2) not null default 0 check (current_amount >= 0),
  last_changed_at date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, name)
);

create index finance_savings_accounts_household_idx
on finance_savings_accounts (household_id, name);

create trigger finance_savings_accounts_set_updated_at
before update on finance_savings_accounts
for each row execute function set_updated_at();

create table finance_savings_transactions (
  id uuid primary key default gen_random_uuid(),
  savings_account_id uuid not null references finance_savings_accounts(id) on delete cascade,
  direction text not null check (direction in ('add', 'subtract')),
  amount numeric(12, 2) not null check (amount > 0),
  changed_at date not null default current_date,
  note text null,
  created_at timestamptz not null default now()
);

create index finance_savings_transactions_account_idx
on finance_savings_transactions (savings_account_id, changed_at desc, created_at desc);
