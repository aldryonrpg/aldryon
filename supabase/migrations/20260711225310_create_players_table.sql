-- Player gameplay aggregate — deliberately separate from `users` (plan2 §3a,
-- §10 "Decided"). `users` stays auth/profile only; `players` is 1:1 via a
-- UNIQUE FK, created on the player's first entry into the game. Max HP and
-- max Stamina are computed in the domain, not stored (plan2 §3a).
create table if not exists players (
  id uuid primary key,
  user_id uuid not null unique references users (id),
  -- The on-screen name (moved off `users` — auth/profile stays there, this
  -- is player-owned gameplay state). Null until the player picks one;
  -- same 5-40 alphanumeric constraint the old `users.username` had.
  player_name varchar(40),
  gold integer not null default 0 check (gold >= 0),
  level integer not null default 1 check (level >= 1),
  -- Hard XP cap at 1,000,000 (plan2 §6b).
  xp integer not null default 0 check (xp >= 0 and xp <= 1000000),
  -- New players start with 10 points to spend; grows on level-up (§6b).
  attribute_points integer not null default 10 check (attribute_points >= 0),
  force integer not null default 1 check (force >= 1),
  dexterity integer not null default 1 check (dexterity >= 1),
  agility integer not null default 1 check (agility >= 1),
  intelligence integer not null default 1 check (intelligence >= 1),
  vitality integer not null default 1 check (vitality >= 1),
  luck integer not null default 1 check (luck >= 1),
  -- Stored in UTC; the API returns ISO-8601 UTC and the front-end converts
  -- to the browser's timezone.
  last_death_at timestamptz,
  -- Drives the run cooldown (plan2 §4 step 1a).
  last_run_at timestamptz,
  -- The kill's drop offer awaiting the player's pick (plan2 §5e); forfeited
  -- on the next /battle/start.
  pending_loot jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_name_alphanumeric check (player_name is null or player_name ~ '^[A-Za-z0-9]{5,40}$')
);
