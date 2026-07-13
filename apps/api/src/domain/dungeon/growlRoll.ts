import { DUNGEON_CONFIG } from "@/domain/dungeon/dungeonConfig";
import type { Rng } from "@/domain/shared/Rng";

/**
 * The boss's awakening roll (plan3 §2e): 50/50 via the injected Rng, so it's
 * deterministic in tests. On success, the boss Growls (destroys every POT
 * stack in the player's bag) as its reveal action; on failure, nothing
 * happens this turn.
 */
export function rollGrowl(rng: Rng): boolean {
  return rng.int(1, 100) <= DUNGEON_CONFIG.growlChancePercent;
}
