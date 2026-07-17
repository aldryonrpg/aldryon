-- Tracks the single owner (if any) of each unique-rarity item — a
-- unique item may exist at most once across the whole server. One row per
-- unique item, created the first time it's ever dropped (not seeded empty
-- for every unique item up front). current_owner_player_id null means the
-- item currently exists but isn't held by anyone (its last owner destroyed
-- or sold it) — the row still exists so owner_history is preserved.
-- owner_history holds at most the last 5 {playerId, timestampOfLastOwnership}
-- tuples (oldest dropped first) so this never bloats.
create table if not exists unique_item_ownership (
  item_id uuid primary key references items (id),
  current_owner_player_id uuid references players (id),
  owner_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
