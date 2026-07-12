-- Player inventory & equipment (plan2 §3d). One row = one bag slot (a
-- stack); using a consumable decrements quantity, deleting the row at 0.
-- Bag capacity (20/25-VIP, special bandage/antidote slots) is enforced by
-- the domain Bag aggregate, not the DB.
create table if not exists player_items (
  id uuid primary key,
  player_id uuid not null references players (id) on delete cascade,
  item_id uuid not null references items (id),
  equipped_slot equipment_position,
  -- Consumables stack up to 5 per row/slot; gear is always quantity 1.
  quantity integer not null default 1 check (quantity between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists player_items_player_id_idx on player_items (player_id);

-- Max ONE equipped item per position (plan2 §3d).
create unique index if not exists player_items_one_per_position
  on player_items (player_id, equipped_slot)
  where equipped_slot is not null;
