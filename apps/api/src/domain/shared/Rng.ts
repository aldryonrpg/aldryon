/**
 * Injected randomness port (plan2 §6: "Randomness is injected ... so unit
 * tests are deterministic"). Lives in domain because the pure combat
 * services below take it as a parameter — infrastructure implements it,
 * usecases/tests inject a fake.
 */
export interface Rng {
  /** Random integer in [min, max], inclusive. */
  int(min: number, max: number): number;
}

/**
 * The one shared "roll a die in [min, max], succeed iff roll <= threshold"
 * shape used across combat (HitCheck's hit roll, EffectResolver's proc
 * roll, and any future one) — every caller supplies its own bounds (they
 * mean different things: a hit-chance floor vs. an effect's minimum Luck
 * lead), only the roll-and-compare mechanics are shared.
 */
export function rollUnderThreshold(min: number, max: number, threshold: number, rng: Rng): boolean {
  return rng.int(min, max) <= threshold;
}
