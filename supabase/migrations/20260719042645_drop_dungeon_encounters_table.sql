-- dungeon_encounters was a single-row pairing ("which dungeon boss is
-- active") that DungeonBossOfTheDayUseCase read via findOne(). Replaced by
-- a deterministic date-based rotation (dayIndex = floor(now/msPerDay) %
-- dungeon_bosses.count) so every replica/process picks the same boss
-- independently, with no pointer row to keep in sync — this table has no
-- remaining reader.
drop table if exists dungeon_encounters;
