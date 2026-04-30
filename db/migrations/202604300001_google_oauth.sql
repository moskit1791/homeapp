alter table users
  add column if not exists google_subject text null;

create unique index if not exists users_google_subject_key
on users (google_subject)
where google_subject is not null;
