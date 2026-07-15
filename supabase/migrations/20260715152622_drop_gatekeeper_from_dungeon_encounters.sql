-- gatekeeper_monster_id is no longer used — each dungeon step now draws a
-- random monster from the whole catalog (Dungeon Enhanced live, never
-- materialized) instead of always refighting one fixed gatekeeper.
-- dungeon_encounters keeps just id/dungeon_boss_id: which boss is the
-- dungeon's current boss identity.
alter table dungeon_encounters drop column gatekeeper_monster_id;
