create table if not exists users (
  -- Generated in application code as UUIDv7 (Bun.randomUUIDv7()), not here —
  -- Postgres 16 has no native uuidv7() default, and id generation belongs to
  -- the domain layer per Clean Architecture. Still a plain `uuid` column.
  id uuid primary key,
  external_auth_id text not null unique,
  email text not null,
  display_name text,
  avatar_url text,
  username varchar(40),
  is_vip boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_alphanumeric check (username is null or username ~ '^[A-Za-z0-9]{1,40}$')
);
