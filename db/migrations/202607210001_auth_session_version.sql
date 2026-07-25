alter table users
  add column if not exists session_version integer not null default 1
  check (session_version > 0);

alter table auth_refresh_tokens
  add column if not exists session_version integer not null default 1
  check (session_version > 0);
