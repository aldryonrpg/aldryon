-- Admin allowlist (plan9 §2): a dedicated table rather than a boolean on
-- users, so granting/revoking admin access is a plain row insert/delete,
-- not a schema change. Ships empty — the first row is inserted by hand.
create table if not exists admins (
  user_id uuid primary key references users(id) on delete cascade,
  created_at timestamptz not null default now()
);
