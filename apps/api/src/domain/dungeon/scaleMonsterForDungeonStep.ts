import { DUNGEON_CONFIG } from "@/domain/dungeon/dungeonConfig";
import type { DungeonTier } from "@/domain/dungeon/dungeonTierForPlayerLevel";
import { scaleAttributesByTier, scaleByTier } from "@/domain/dungeon/tierScaling";
import { Monster } from "@/domain/monster/Monster";

/**
 * "Dungeon Enhances" any catalog monster for one dungeon step's fight
 * (loot-system follow-up): hp/attributes/maxStamina scaled by the tier's
 * 100/150/200% multiplier and level set to the tier's boss-equivalent level
 * (10/15/20) — same rounding convention as scaleDungeonBossStats, and
 * deliberately NOT touching xpGain (the monster keeps its own catalog XP
 * value). Returns a brand-new in-memory Monster — never persisted, so any
 * of the catalog's monsters can fill any step at any tier without adding
 * rows to `monsters` (unlike the boss's own materialize-once mechanism,
 * which is unrelated and unaffected by this).
 */
export function scaleMonsterForDungeonStep(monster: Monster, tier: DungeonTier): Monster {
  const multiplier = DUNGEON_CONFIG.tierMultiplier[tier];
  return Monster.create({
    ...monster.toProps(),
    hp: scaleByTier(monster.hp, multiplier),
    level: DUNGEON_CONFIG.tierBossLevel[tier],
    maxStamina: scaleByTier(monster.maxStamina, multiplier),
    attributes: scaleAttributesByTier(monster.getAttributes().toValues(), multiplier),
  });
}
