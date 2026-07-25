alter table household_encryption_settings
  drop constraint if exists household_encryption_settings_enabled_modules_check;

alter table household_encryption_settings
  add constraint household_encryption_settings_enabled_modules_check
  check (
    enabled_modules <@ array[
      'finances',
      'calendar',
      'meal_planner',
      'shopping',
      'todo',
      'notes',
      'cleaning',
      'annual_costs',
      'data_entries',
      'attachments'
    ]::text[]
  );

alter table meal_plan_entries
  add column if not exists encrypted_payload text null,
  add column if not exists encryption_version integer null;

alter table meal_ideas
  add column if not exists encrypted_payload text null,
  add column if not exists encryption_version integer null;

alter table shopping_list_items
  add column if not exists encrypted_payload text null,
  add column if not exists encryption_version integer null;

alter table todo_items
  add column if not exists encrypted_payload text null,
  add column if not exists encryption_version integer null;

alter table note_items
  add column if not exists encrypted_payload text null,
  add column if not exists encryption_version integer null;

alter table cleaning_tasks
  add column if not exists encrypted_payload text null,
  add column if not exists encryption_version integer null;

alter table annual_costs
  add column if not exists encrypted_payload text null,
  add column if not exists encryption_version integer null;

alter table annual_cost_history
  add column if not exists encrypted_payload text null,
  add column if not exists encryption_version integer null;

alter table data_entries
  add column if not exists encrypted_payload text null,
  add column if not exists encryption_version integer null;

alter table attachments
  add column if not exists encrypted_payload text null,
  add column if not exists encryption_version integer null;
