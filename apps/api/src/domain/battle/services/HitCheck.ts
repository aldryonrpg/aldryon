import { BATTLE_CONFIG } from "@/domain/battle/battleConfig";
import type { Rng } from "@/domain/shared/Rng";

export interface HitCheckInput {
  attackerDexterity: number;
  defenderDexterity: number;
  attackerLuck: number;
}

/** HitChance = (AttackerDexterity / DefenderDexterity) * 100 + AttackerLuck (plan2 §6). */
export function computeHitChance(input: HitCheckInput): number {
  return (input.attackerDexterity / input.defenderDexterity) * 100 + input.attackerLuck;
}

/**
 * >=100 hit chance guarantees a hit; otherwise roll [20,100] and hit iff the
 * roll is <= hitChance (plan2 §6).
 */
export function rollHit(input: HitCheckInput, rng: Rng): boolean {
  const hitChance = computeHitChance(input);
  if (hitChance >= 100) return true;
  const roll = rng.int(BATTLE_CONFIG.rollMin, BATTLE_CONFIG.rollMax);
  return roll <= hitChance;
}
