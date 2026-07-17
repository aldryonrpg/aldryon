-- Dungeon boss catalog (plan3 §2c) — separate from `monsters` because bosses
-- are unique, hand-designed encounters with a rare legendary_drops pool
-- nothing else in the game has, and their stats are a *base* (tier-1/level-10
-- baseline) scaled on demand by scaleDungeonBossStats, not fixed catalog
-- values. base_max_stamina is copied verbatim into the materialized
-- monsters.max_stamina (not tier-scaled — monster Stamina pools are already
-- "tunable per monster", independent of level, same as the base monsters
-- table).
create table if not exists dungeon_bosses (
  id uuid primary key,
  name text not null unique,
  description text not null,
  monster_image text not null,
  monster_type monster_type not null default 'normal',
  base_hp integer not null check (base_hp >= 1),
  base_xp_gain integer not null check (base_xp_gain >= 0),
  base_max_stamina integer not null default 100 check (base_max_stamina >= 1),
  base_force integer not null default 1 check (base_force >= 1),
  base_dexterity integer not null default 1 check (base_dexterity >= 1),
  base_agility integer not null default 1 check (base_agility >= 1),
  base_intelligence integer not null default 1 check (base_intelligence >= 1),
  base_vitality integer not null default 1 check (base_vitality >= 1),
  base_luck integer not null default 1 check (base_luck >= 1),
  -- Array of { itemId, dropRate } tuples, same shape as monsters.drops.
  drops jsonb not null default '[]'::jsonb,
  exclusive_drops jsonb not null default '[]'::jsonb,
  -- Third pool, unique to dungeon bosses: legendary-rarity items at a very
  -- low dropRate, rolled independently alongside the other two (plan3 §2c).
  legendary_drops jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
