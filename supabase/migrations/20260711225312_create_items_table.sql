-- Item catalog (plan2 §3b). Attribute columns here are equip *bonuses*:
-- default 0, may be negative (cursed gear), no >=1 floor — that floor is a
-- fighter-only rule enforced on players/monsters, not items (plan2 §2).
create table if not exists items (
  id uuid primary key,
  name text not null unique,
  description text not null,
  value integer not null check (value >= 0),
  rarity item_rarity not null,
  -- null = not equippable (consumables/quest items for the "Bag" action).
  slot equipment_slot,
  force integer not null default 0,
  dexterity integer not null default 0,
  agility integer not null default 0,
  intelligence integer not null default 0,
  vitality integer not null default 0,
  luck integer not null default 0,
  -- Consumables like POTs: using one via /battle/bag restores this much HP
  -- (capped at max). NULL check constraints pass when the column is NULL,
  -- so this only fires when hp_restore is actually set.
  hp_restore integer check (hp_restore > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
