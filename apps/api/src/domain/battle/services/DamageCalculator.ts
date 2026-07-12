export interface DamageInput {
  /** attack.multiplier of the move being used. */
  attackMultiplier: number;
  /** Attacker's effective value of the attack's scaling attribute (Force/Intelligence). */
  attackerScalingValue: number;
  /** attack.stamina_cost — added, not multiplied, so 0-cost HIT needs no special-casing. */
  staminaCost: number;
  /** Defender's level (or a monster's fixed catalog level). */
  defenderLevel: number;
  /** Defender's effective value of their current-stance attack's scaling attribute. */
  defenderScalingValue: number;
}

/**
 * Damage = (attack.multiplier * effective(scaling attribute) + stamina_cost)
 *          - defender_level * effective(defender scaling attribute)
 * Clamped at 0 (plan2 §6).
 */
export function computeDamage(input: DamageInput): number {
  const attackValue = input.attackMultiplier * input.attackerScalingValue + input.staminaCost;
  const defenseValue = input.defenderLevel * input.defenderScalingValue;
  return Math.max(0, attackValue - defenseValue);
}
