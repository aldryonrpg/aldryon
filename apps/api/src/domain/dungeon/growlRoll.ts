import { DUNGEON_CONFIG } from "@/domain/dungeon/dungeonConfig";
import type { Rng } from "@/domain/shared/Rng";

/**
 * The boss's awakening roll (loot-system follow-up): always fires on boss
 * reveal (no longer a 50/50 gate) — returns how many percent (0-50,
 * inclusive) of the player's remaining POTs the Growl breaks. 0 means no
 * POTs break this time; the caller still narrates the Growl either way.
 */
export function rollGrowlBreakPercent(rng: Rng): number {
  return rng.int(0, DUNGEON_CONFIG.growlBreakPercentMax);
}
