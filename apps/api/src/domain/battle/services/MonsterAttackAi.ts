import type { MonsterAttack } from "@/domain/monster/MonsterAttack";

export interface WeightedAttackCandidate {
  attack: MonsterAttack;
  /** Damage this attack would deal if it hits — used purely as a score input. */
  damage: number;
}

/**
 * Monster attack-selection AI (plan2 §6a): among affordable non-special
 * attacks, picks the one with the highest `damage + weight` score, where
 * weight is how many consecutive turns that attack has gone unpicked
 * (`bumpAttackWeights` below). A long-unused weaker attack can eventually
 * outscore a frequently-picked stronger one, so the monster rotates through
 * its moveset instead of always repeating the single best hit. Specials are
 * handled separately by the caller — they're chosen unconditionally over any
 * normal attack whenever one is affordable, never scored against this.
 */
export function selectByWeightedDamage(
  candidates: readonly WeightedAttackCandidate[],
  weights: Readonly<Record<string, number>>,
): MonsterAttack {
  if (candidates.length === 0) {
    throw new Error("Cannot select a monster attack from an empty candidate list");
  }
  let best = candidates[0] as WeightedAttackCandidate;
  let bestScore = best.damage + (weights[best.attack.id] ?? 0);
  for (const candidate of candidates.slice(1)) {
    const score = candidate.damage + (weights[candidate.attack.id] ?? 0);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best.attack;
}

/**
 * Advances the weight counters for one turn: the picked non-special attack
 * (if any) resets to 0, every other non-special attack in the moveset gains
 * `+increment` — including ones that weren't affordable this turn, and
 * including every attack on a turn where the monster rested or started
 * charging a special instead (nothing was "picked" among the normals either
 * way). Specials never appear in the weights map — they don't participate in
 * this scoring. The caller passes the monster's own level as `increment`, so
 * a higher-level monster rotates through its moveset faster than a low-level
 * one facing the identical scoring gap.
 */
export function bumpAttackWeights(
  weights: Readonly<Record<string, number>>,
  moveset: readonly MonsterAttack[],
  pickedNormalAttackId: string | null,
  increment: number,
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const attack of moveset) {
    if (attack.isSpecial) continue;
    next[attack.id] =
      attack.id === pickedNormalAttackId ? 0 : (weights[attack.id] ?? 0) + increment;
  }
  return next;
}
