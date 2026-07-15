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

/**
 * Rolls the legendary_drops pool specifically (loot-system follow-up) — a
 * per-mille scale, not the 0-100 percent the other two pools use, since
 * legendary/unique items need much finer-grained rarity than a 100-sided
 * roll allows. dropRate=1 means 1-in-1000; dropRate=0.01 means 1-in-100000.
 * `rng.int(1, 100000) <= dropRate * 100` gives exactly that resolution.
 * Otherwise identical to rollDropPool: independent rolls, random winner
 * among any that succeed.
 */
export function rollLegendaryDropPool(pool: DropTuple[], rng: Rng): string | null {
  const successes = pool.filter((tuple) => rng.int(1, 100_000) <= tuple.dropRate * 100);
  if (successes.length === 0) return null;
  const winner = successes[rng.int(0, successes.length - 1)];
  return winner?.itemId ?? null;
}
