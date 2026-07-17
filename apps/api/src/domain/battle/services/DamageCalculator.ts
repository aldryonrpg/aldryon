export interface DamageInput {
  /** attack.multiplier of the move being used. */
  attackMultiplier: number;
  /** Attacker's effective value of the attack's scaling attribute (Strength/Intelligence). */
  attackerScalingValue: number;
  /** attack.stamina_cost — added, not multiplied, so a cheap attack needs no special-casing. */
  staminaCost: number;
  /** Defender's level (or a monster's fixed catalog level). */
  defenderLevel: number;
  /** Defender's effective value of their current-stance attack's scaling attribute. */
  defenderScalingValue: number;
}

/**
 * Damage = (attack.multiplier * effective(scaling attribute) + stamina_cost)
 *          - ceil(floor[(defender_level + 1) / 2] * effective(defender scaling attribute) / 2)
 * Floored at 1 (a landed hit always deals at least 1 damage — plan2 §6,
 * revised combat-balance follow-up). The multiplier can be fractional, so
 * both the attack value and the defense value are always rounded UP before
 * combining — damage/defense never round in the defender's favor. Halving
 * the defense term (and flooring the level term at half-steps) keeps
 * defense from outscaling every attacker's own damage output as both sides
 * level up — the original `level * stat` term grew too fast relative to
 * `multiplier * stat` and made high-level fights stalemate at 0 damage on
 * both sides.
 */
export function computeDamage(input: DamageInput): number {
  const attackValue = Math.ceil(input.attackMultiplier * input.attackerScalingValue);
  const levelTerm = Math.floor((input.defenderLevel + 1) / 2);
  const defenseValue = Math.ceil((levelTerm * input.defenderScalingValue) / 2);
  return Math.max(1, attackValue + input.staminaCost - defenseValue);
}
