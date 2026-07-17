import { BATTLE_CONFIG } from "@/domain/battle/battleConfig";
import { type Rng, rollUnderThreshold } from "@/domain/shared/Rng";

export interface HitCheckInput {
  attackerDexterity: number;
  defenderAgility: number;
  attackerLuck: number;
}

/** HitChance = (AttackerDexterity / DefenderAgility) * 100 + AttackerLuck — gives Agility a
 * defensive role (dodge) instead of sitting unused outside of Run checks. */
export function computeHitChance(input: HitCheckInput): number {
  return (input.attackerDexterity / input.defenderAgility) * 100 + input.attackerLuck;
}

/**
 * >=100 hit chance guarantees a hit; otherwise roll [hitRollMin,hitRollMax]
 * and hit iff the roll is <= hitChance (plan2 §6).
 */
export function rollHit(input: HitCheckInput, rng: Rng): boolean {
  const hitChance = computeHitChance(input);
  if (hitChance >= 100) return true;
  return rollUnderThreshold(BATTLE_CONFIG.hitRollMin, BATTLE_CONFIG.hitRollMax, hitChance, rng);
}
