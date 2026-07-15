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
 *          - defender_level * effective(defender scaling attribute)
 * Clamped at 0 (plan2 §6). The multiplier can be fractional, so both the
 * attack value and the defense value are always rounded UP before
 * combining — damage/defense never round in the defender's favor.
 */
export function computeDamage(input: DamageInput): number {
  const attackValue = Math.ceil(input.attackMultiplier * input.attackerScalingValue);
  const defenseValue = Math.ceil(input.defenderLevel * input.defenderScalingValue);
  return Math.max(0, attackValue + input.staminaCost - defenseValue);
}
