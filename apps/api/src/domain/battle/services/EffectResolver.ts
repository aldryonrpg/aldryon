import { BATTLE_CONFIG } from "@/domain/battle/battleConfig";
import type { Rng } from "@/domain/shared/Rng";

export interface ProcInput {
  attackerLuck: number;
  defenderLuck: number;
}

/**
 * Unified effect proc, both directions (plan2 §6a): on a successful hit that
 * can apply an effect, roll [20,100] and it lands iff roll <= (attacker
 * effective Luck - defender effective Luck). Because the roll floor is 20,
 * an effect never lands below a 20-point Luck lead. Specials bypass this
 * roll entirely (plan2 §3f) — callers just skip invoking it for those.
 */
export function rollEffectProc(input: ProcInput, rng: Rng): boolean {
  const roll = rng.int(BATTLE_CONFIG.rollMin, BATTLE_CONFIG.rollMax);
  return roll <= input.attackerLuck - input.defenderLuck;
}
