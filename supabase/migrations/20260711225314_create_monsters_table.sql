-- Monster catalog (plan2 §3c). Drop tuples stay inline as JSONB — no drops
-- join table. Referential integrity to items is checked in the usecase when
-- drops are rolled (a dangling itemId logs + skips, never crashes a battle).
create table if not exists monsters (
  id uuid primary key,
  name text not null unique,
  description text not null,
  region monster_region not null,
  -- CDN URL of the monster's PNG, one per monster.
  monster_image text not null unique,
  hp integer not null check (hp >= 1),
  xp_gain integer not null check (xp_gain >= 0),
  -- Not in plan2 §3c's field table, but the shared damage formula (§6) needs
  -- a `defender_level` for monsters "the same way" as players, and monsters
  -- don't level up — so it's fixed catalog data, tunable per monster.
  level integer not null default 1 check (level >= 1),
  force integer not null default 1 check (force >= 1),
  dexterity integer not null default 1 check (dexterity >= 1),
  agility integer not null default 1 check (agility >= 1),
  intelligence integer not null default 1 check (intelligence >= 1),
  vitality integer not null default 1 check (vitality >= 1),
  luck integer not null default 1 check (luck >= 1),
  -- Innate on-hit ability (plan2 §3c/§6a): normal -> bleed, poisonous -> poison.
  monster_type monster_type not null default 'normal',
  -- Array of { itemId, dropRate } tuples.
  drops jsonb not null default '[]'::jsonb,
  exclusive_drops jsonb not null default '[]'::jsonb,
  -- % chance the monster attacks instantly on encounter (plan2 §4 step 4).
  ambush_chance integer not null default 0 check (ambush_chance between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists monsters_region_idx on monsters (region);
