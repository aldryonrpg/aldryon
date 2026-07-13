-- Dungeon Slayer leaderboard (plan3 §2g). One row per player who has ever
-- killed the tier-3 (level-20) dungeon boss at least once — no zero-row
-- seeded for every player. A global ordered leaderboard is a fundamentally
-- different access pattern from the single-row-by-id reads everything else
-- on players does, so it gets its own table rather than columns on players.
create table if not exists dungeon_slayer_rankings (
  player_id uuid primary key references players (id),
  kills integer not null default 0 check (kills >= 0),
  last_kill_at timestamptz
);

-- Backs GET /dungeon/leaderboard directly: top N by kills desc, ties by
-- last_kill_at asc (whoever reached that count first ranks higher).
create index if not exists dungeon_slayer_rankings_leaderboard_idx
  on dungeon_slayer_rankings (kills desc, last_kill_at asc);

-- Covering index: any query filtering/sorting by recency and then joining to
-- players on player_id for the display name is satisfied as an index-only
-- scan, without a heap fetch on this table first.
create index if not exists dungeon_slayer_rankings_recency_idx
  on dungeon_slayer_rankings (last_kill_at) include (player_id);
