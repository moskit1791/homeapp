create table finance_debt_payments (
  id uuid primary key default gen_random_uuid(),
  finance_debt_id uuid not null references finance_debts(id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  paid_at date not null default current_date,
  note text null,
  created_at timestamptz not null default now()
);

create index finance_debt_payments_debt_idx
on finance_debt_payments (finance_debt_id, paid_at desc, created_at desc);
