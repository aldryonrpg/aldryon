import { BATTLE_CONFIG } from "@/domain/battle/battleConfig";
import { type Rng, rollUnderThreshold } from "@/domain/shared/Rng";

export interface ProcInput {
  attackerLuck: number;
  defenderLuck: number;
}

/**
 * Unified effect proc, both directions (plan2 §6a): on a successful hit that
 * can apply an effect, roll [effectProcRollMin,effectProcRollMax] and it
 * lands iff roll <= (attacker effective Luck - defender effective Luck).
 * Because the roll floor is effectProcRollMin, an effect can never land
 * below that many points of Luck lead. Specials bypass this roll entirely
 * (plan2 §3f) — callers just skip invoking it for those.
 */
export function rollEffectProc(input: ProcInput, rng: Rng): boolean {
  return rollUnderThreshold(
    BATTLE_CONFIG.effectProcRollMin,
    BATTLE_CONFIG.effectProcRollMax,
    input.attackerLuck - input.defenderLuck,
    rng,
  );
}
