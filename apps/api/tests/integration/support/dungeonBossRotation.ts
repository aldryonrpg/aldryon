import type { DungeonBoss } from "@/domain/dungeon/DungeonBoss";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Computes a `now()` clock value that deterministically makes
 * DungeonBossOfTheDayUseCase's day-based rotation
 * (`floor(now/msPerDay) % bosses.length`, indexing `findAll()`'s
 * name-ordered list) resolve to `bossName`, regardless of how many bosses
 * are in the catalog or what today's real rotation happens to land on.
 * `bosses` should come straight from `dungeonBossRepository.findAll()` so
 * the ordering matches production exactly. Pass the result as the `now`
 * arg to `buildUseCases`.
 */
export function nowForBoss(bosses: DungeonBoss[], bossName: string): number {
  const index = bosses.findIndex((b) => b.name === bossName);
  if (index === -1) {
    throw new Error(`nowForBoss: no dungeon boss named "${bossName}" in the given list`);
  }
  return index * MS_PER_DAY;
}

/**
 * Mirrors DungeonBossOfTheDayUseCase's own rotation formula exactly — for
 * tests that span a real day boundary (so both sides can't be pinned to the
 * same boss via nowForBoss, since consecutive days are never the same index
 * once there's more than one boss) and need to assert against whichever
 * boss production would legitimately pick for a given `now`.
 */
export function bossNameForDay(bosses: DungeonBoss[], now: number): string {
  const dayIndex = Math.floor(now / MS_PER_DAY) % bosses.length;
  const boss = bosses[dayIndex];
  if (!boss) throw new Error("bossNameForDay: rotation index out of range");
  return boss.name;
}
