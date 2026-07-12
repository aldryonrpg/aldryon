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
