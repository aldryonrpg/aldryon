import type { Battle } from "@/domain/battle/Battle";
import { scaleMonsterForDungeonStep } from "@/domain/dungeon/scaleMonsterForDungeonStep";
import type { Monster } from "@/domain/monster/Monster";

/**
 * Dungeon step (non-boss) monsters are never persisted pre-scaled —
 * `MonsterCatalogCache` only ever holds their base catalog stats, and the
 * Dungeon-Enhanced copy `scaleMonsterForDungeonStep` builds at
 * `/dungeon/start`/`/dungeon/continue` only ever lived in memory for that
 * one call. Every later read of "the monster" for an already-ongoing
 * battle (an attack, a rest, a bag item, a flee, or a reload via
 * GetActiveBattleUseCase) must re-apply that same scaling here, or it
 * silently fights the rest of the encounter — HP, attributes, damage
 * output, everything — at un-scaled base stats. Dungeon bosses don't need
 * this: their materialized row (DungeonBossOfTheDayUseCase) is already
 * scaled once in the database, so re-scaling it again here would double it.
 */
export function resolveBattleMonster(rawMonster: Monster, battle: Battle): Monster {
  if (battle.dungeonTier === null || battle.dungeonIsBossFight) return rawMonster;
  return scaleMonsterForDungeonStep(rawMonster, battle.dungeonTier);
}
