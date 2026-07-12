-- Auth/profile only (plan2 §3a/§10): the on-screen player_name lives on
-- `players` instead — this table never mixes gameplay concerns in.
create table if not exists users (
  id uuid primary key,
  external_auth_id text not null unique,
  email text not null,
  display_name text,
  avatar_url text,
  is_vip boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
