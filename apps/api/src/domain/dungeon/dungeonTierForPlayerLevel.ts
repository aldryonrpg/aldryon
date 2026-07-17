import { MINIMUM_DUNGEON_LEVEL } from "@/domain/dungeon/dungeonConfig";

export type DungeonTier = 1 | 2 | 3;

/**
 * Tier is a direct function of the player's own level, not a shared daily
 * rotation (plan3 §2c) — 10-14 -> tier 1, 15-19 -> tier 2, 20+ -> tier 3 (no
 * tier 4 to grow into). Two players of the same level always face the
 * identical (materialized) boss row.
 */
export function dungeonTierForPlayerLevel(level: number): DungeonTier {
  if (level < MINIMUM_DUNGEON_LEVEL) {
    throw new Error(`Level ${level} is below the minimum dungeon level (${MINIMUM_DUNGEON_LEVEL})`);
  }
  if (level < 15) return 1;
  if (level < 20) return 2;
  return 3;
}
