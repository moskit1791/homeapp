create table household_encryption_settings (
  household_id uuid primary key references households(id) on delete cascade,
  enabled_modules text[] not null default '{}',
  key_version integer not null default 1 check (key_version > 0),
  kdf_salt text not null,
  wrapped_key text not null,
  recovery_wrapped_key text not null,
  configured_by_member_id uuid null references household_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (enabled_modules <@ array['finances', 'calendar']::text[])
);

create trigger household_encryption_settings_set_updated_at
before update on household_encryption_settings
for each row execute function set_updated_at();

alter table calendar_events
  add column if not exists encrypted_payload text null,
  add column if not exists encryption_version integer null;

alter table budget_categories
  add column if not exists encrypted_payload text null,
  add column if not exists encryption_version integer null;

alter table budget_items
  add column if not exists encrypted_payload text null,
  add column if not exists encryption_version integer null;

alter table expenses
  add column if not exists encrypted_payload text null,
  add column if not exists encryption_version integer null;

alter table monthly_incomes
  add column if not exists encrypted_payload text null,
  add column if not exists encryption_version integer null;

alter table finance_debts
  add column if not exists encrypted_payload text null,
  add column if not exists encryption_version integer null;

alter table finance_debt_payments
  add column if not exists encrypted_payload text null,
  add column if not exists encryption_version integer null;

alter table finance_savings_accounts
  add column if not exists encrypted_payload text null,
  add column if not exists encryption_version integer null;

alter table finance_savings_transactions
  add column if not exists encrypted_payload text null,
  add column if not exists encryption_version integer null;
