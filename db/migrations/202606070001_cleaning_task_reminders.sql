alter table cleaning_tasks
  add column if not exists reminder_sent_at timestamptz null;

create index if not exists cleaning_tasks_reminder_due_idx
on cleaning_tasks (next_due_at, reminder_sent_at)
where reminder_sent_at is null;
