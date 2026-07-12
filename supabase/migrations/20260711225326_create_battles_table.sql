-- The only new *stateful* table (plan2 §3h). A row exists only while a
-- battle is live: created by battle start, deleted when it ends (kill,
-- death, or flee). The plain UNIQUE(player_id) enforces one battle per
-- player with no partial index or state flag.
create table if not exists battles (
  id uuid primary key,
  player_id uuid not null unique references players (id) on delete cascade,
  monster_id uuid not null references monsters (id),
  player_current_hp integer not null check (player_current_hp >= 0),
  player_current_stamina integer not null check (player_current_stamina >= 0),
  monster_current_hp integer not null check (monster_current_hp >= 0),
  monster_current_stamina integer not null check (monster_current_stamina >= 0),
  -- Effects tick per round (plan2 §6a).
  round integer not null default 1,
  player_effects jsonb not null default '[]'::jsonb,
  monster_effects jsonb not null default '[]'::jsonb,
  -- Set while the monster charges a special (plan2 §3f). Both null/0 when
  -- not charging.
  monster_charging_attack_id uuid references monster_attacks (id),
  charge_rounds_left integer not null default 0,
  created_at timestamptz not null default now()
);
