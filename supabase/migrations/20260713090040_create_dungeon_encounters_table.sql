-- Gatekeeper/boss pairing (plan3 §2c). Tier no longer selects a different
-- catalog row — it's purely a scaling multiplier applied at materialization
-- time — so one pairing row covers all 3 tiers. gatekeeper_monster_id points
-- at an ordinary monsters row (an existing wild monster reused as the
-- gatekeeper), not a dedicated dungeon-only entity.
create table if not exists dungeon_encounters (
  id uuid primary key,
  gatekeeper_monster_id uuid not null references monsters (id),
  dungeon_boss_id uuid not null references dungeon_bosses (id)
);
