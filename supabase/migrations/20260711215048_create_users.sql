-- Mirrors apps/api/src/infrastructure/persistence/migrations/0001_create_users.sql
-- (the canonical source, applied automatically to the docker-compose and
-- testcontainers Postgres instances). This copy is what the Supabase CLI
-- pushes to the real Supabase project via `bun run db:push:supabase` — see
-- apps/api's migrations folder for the authoring source and comments.
create table if not exists users (
  id uuid primary key,
  external_auth_id text not null unique,
  email text not null,
  display_name text,
  avatar_url text,
  username varchar(40),
  is_vip boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_alphanumeric check (username is null or username ~ '^[A-Za-z0-9]{5,40}$')
);
