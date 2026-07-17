import { DUNGEON_CONFIG } from "@/domain/dungeon/dungeonConfig";
import type { DungeonTier } from "@/domain/dungeon/dungeonTierForPlayerLevel";
import { scaleAttributesByTier, scaleByTier } from "@/domain/dungeon/tierScaling";
import type { AttributeValues } from "@/domain/shared/Attributes";

export interface DungeonBossBaseStats {
  hp: number;
  xpGain: number;
  attributes: AttributeValues;
}

export interface ScaledDungeonBossStats {
  hp: number;
  xpGain: number;
  attributes: AttributeValues;
}

/**
 * hp/xpGain/each attribute scale by tier (100/150/200%), Math.ceil-rounded —
 * the same "never round in the defender's favor" convention as
 * DamageCalculator (plan3 §2c). base_max_stamina is NOT scaled here — it's
 * copied verbatim by the caller, since monster Stamina pools already aren't
 * level-derived to begin with.
 */
export function scaleDungeonBossStats(
  base: DungeonBossBaseStats,
  tier: DungeonTier,
): ScaledDungeonBossStats {
  const multiplier = DUNGEON_CONFIG.tierMultiplier[tier];
  return {
    hp: scaleByTier(base.hp, multiplier),
    xpGain: scaleByTier(base.xpGain, multiplier),
    attributes: scaleAttributesByTier(base.attributes, multiplier),
  };
}
