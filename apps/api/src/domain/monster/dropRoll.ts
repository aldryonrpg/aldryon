import type { DropTuple } from "@/domain/monster/Monster";
import type { Rng } from "@/domain/shared/Rng";

/**
 * Rolls one drop pool independently (plan2 §3c/§10): every tuple rolls its
 * own dropRate; if several succeed, one winner is picked at random among
 * them. Returns the winning itemId, or null if nothing procs.
 */
export function rollDropPool(pool: DropTuple[], rng: Rng): string | null {
  const successes = pool.filter((tuple) => rng.int(1, 100) <= tuple.dropRate);
  if (successes.length === 0) return null;
  const winner = successes[rng.int(0, successes.length - 1)];
  return winner?.itemId ?? null;
}
