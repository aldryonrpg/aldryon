import { pickUnrevealedAttributes, rollRevealCount } from "@/domain/monster/monsterAttributeReveal";
import type { AttributeKey, Attributes } from "@/domain/shared/Attributes";
import type { Rng } from "@/domain/shared/Rng";

export interface AttackRevealResult {
  revealedMonsterAttributes: AttributeKey[];
  message: string;
}

/**
 * REVEAL SPELL's on-hit effect — how many of the monster's remaining hidden
 * attributes get uncovered (scales with the caster's own effective
 * Intelligence, see rollRevealCount) and the narration for it. Pulled out of
 * AttackUseCase into its own module, matching the resolveMonsterTurn/
 * resolveCounterItem/resolveLegendaryDrop "usecase/battle/resolveXxx"
 * convention, so the roll-count/pick/message trio has one dedicated,
 * directly testable home.
 *
 * Callers must already have confirmed at least one attribute remains
 * unrevealed (AttackUseCase's upfront AttackNotUsableError guard checks
 * this before the turn is ever charged) — this never reveals zero.
 */
export function resolveAttackReveal(
  casterIntelligence: number,
  revealedMonsterAttributes: readonly AttributeKey[],
  monsterAttributes: Attributes,
  rng: Rng,
): AttackRevealResult {
  const revealCount = rollRevealCount(casterIntelligence, rng);
  const revealedKeys = pickUnrevealedAttributes(revealedMonsterAttributes, rng, revealCount);
  const parts = revealedKeys.map((key) => {
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    return `${label}: ${monsterAttributes.get(key)}`;
  });
  return {
    revealedMonsterAttributes: [...revealedMonsterAttributes, ...revealedKeys],
    message: `You glimpse the monster's ${parts.join(", ")}!`,
  };
}
