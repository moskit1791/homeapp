alter table users
  alter column auth_provider_user_id set default gen_random_uuid();

alter table users
  add column if not exists password_hash text null,
  add column if not exists email_verified_at timestamptz null,
  add column if not exists email_verification_token_hash text null,
  add column if not exists email_verification_expires_at timestamptz null,
  add column if not exists password_reset_token_hash text null,
  add column if not exists password_reset_expires_at timestamptz null;

create table if not exists auth_refresh_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists auth_refresh_tokens_user_id_idx
on auth_refresh_tokens (user_id);

create index if not exists auth_refresh_tokens_active_idx
on auth_refresh_tokens (user_id, expires_at)
where revoked_at is null;

drop trigger if exists auth_refresh_tokens_set_updated_at on auth_refresh_tokens;
create trigger auth_refresh_tokens_set_updated_at
before update on auth_refresh_tokens
for each row execute function set_updated_at();
