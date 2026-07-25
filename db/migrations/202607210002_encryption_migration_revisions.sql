create or replace function rotate_encryption_migration_revision()
returns trigger
language plpgsql
as $$
begin
  new.encryption_migration_revision = gen_random_uuid();
  return new;
end;
$$;

alter table calendar_events add column if not exists encryption_migration_revision uuid not null default gen_random_uuid();
alter table budget_categories add column if not exists encryption_migration_revision uuid not null default gen_random_uuid();
alter table budget_items add column if not exists encryption_migration_revision uuid not null default gen_random_uuid();
alter table expenses add column if not exists encryption_migration_revision uuid not null default gen_random_uuid();
alter table monthly_incomes add column if not exists encryption_migration_revision uuid not null default gen_random_uuid();
alter table finance_debts add column if not exists encryption_migration_revision uuid not null default gen_random_uuid();
alter table finance_debt_payments add column if not exists encryption_migration_revision uuid not null default gen_random_uuid();
alter table finance_savings_accounts add column if not exists encryption_migration_revision uuid not null default gen_random_uuid();
alter table finance_savings_transactions add column if not exists encryption_migration_revision uuid not null default gen_random_uuid();
alter table meal_plan_entries add column if not exists encryption_migration_revision uuid not null default gen_random_uuid();
alter table meal_ideas add column if not exists encryption_migration_revision uuid not null default gen_random_uuid();
alter table shopping_list_items add column if not exists encryption_migration_revision uuid not null default gen_random_uuid();
alter table todo_items add column if not exists encryption_migration_revision uuid not null default gen_random_uuid();
alter table note_items add column if not exists encryption_migration_revision uuid not null default gen_random_uuid();
alter table cleaning_tasks add column if not exists encryption_migration_revision uuid not null default gen_random_uuid();
alter table annual_costs add column if not exists encryption_migration_revision uuid not null default gen_random_uuid();
alter table annual_cost_history add column if not exists encryption_migration_revision uuid not null default gen_random_uuid();
alter table data_entries add column if not exists encryption_migration_revision uuid not null default gen_random_uuid();
alter table attachments add column if not exists encryption_migration_revision uuid not null default gen_random_uuid();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'calendar_events', 'budget_categories', 'budget_items', 'expenses', 'monthly_incomes',
    'finance_debts', 'finance_debt_payments', 'finance_savings_accounts',
    'finance_savings_transactions', 'meal_plan_entries', 'meal_ideas', 'shopping_list_items',
    'todo_items', 'note_items', 'cleaning_tasks', 'annual_costs', 'annual_cost_history',
    'data_entries', 'attachments'
  ]
  loop
    execute format('drop trigger if exists %I on %I', table_name || '_rotate_encryption_revision', table_name);
    execute format(
      'create trigger %I before update on %I for each row execute function rotate_encryption_migration_revision()',
      table_name || '_rotate_encryption_revision',
      table_name
    );
  end loop;
end;
$$;
