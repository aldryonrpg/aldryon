import type { DropTuple } from "@/domain/monster/Monster";
import type { Rng } from "@/domain/shared/Rng";

/**
 * Rolls one drop pool independently (plan2 §3c/§10, unified to a per-mille
 * scale for `drops`/`exclusiveDrops`/`legendaryDrops` alike): every tuple
 * rolls its own dropRate; if several succeed, one winner is picked at random
 * among them. Returns the winning itemId, or null if nothing procs.
 * dropRate=1 means 1-in-1000; dropRate=0.01 means 1-in-100000; dropRate=1000
 * is a guaranteed drop. `rng.int(1, 100000) <= dropRate * 100` gives exactly
 * that resolution. Legendary/unique rarity is further restricted to dungeon
 * bosses' legendaryDrops pool and global-uniqueness enforcement (see
 * `resolveLegendaryDrop`), not by a different roll formula.
 */
export function rollDropPool(pool: DropTuple[], rng: Rng): string | null {
  const successes = pool.filter((tuple) => rng.int(1, 100_000) <= tuple.dropRate * 100);
  if (successes.length === 0) return null;
  const winner = successes[rng.int(0, successes.length - 1)];
  return winner?.itemId ?? null;
}
