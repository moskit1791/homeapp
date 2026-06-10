alter table finance_savings_accounts
  add column owner_member_id uuid null references household_members(id) on delete set null,
  add column target_amount numeric(12, 2) null,
  add column target_date date null;

create index finance_savings_accounts_owner_idx
on finance_savings_accounts (household_id, owner_member_id, target_date, name);
