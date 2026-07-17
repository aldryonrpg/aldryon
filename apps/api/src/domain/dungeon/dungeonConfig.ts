/**
 * Pure dungeon-rule constants (plan3 §2b/§2c/§2e/§2f). No process.env here,
 * same rule as battleConfig.ts.
 */
export const MINIMUM_DUNGEON_LEVEL = 10;

export const DUNGEON_CONFIG = {
  minimumLevel: MINIMUM_DUNGEON_LEVEL,
  /** hp/xpGain/attributes multiplier per tier (plan3 §2c). */
  tierMultiplier: { 1: 1.0, 2: 1.5, 3: 2.0 } as const,
  /** Fixed catalog `level` (damage-formula defender_level) for the
   * materialized boss monsters row per tier (plan3 §2c's table) — also used
   * as the defender_level for a live-scaled dungeon-step monster. */
  tierBossLevel: { 1: 10, 2: 15, 3: 20 } as const,
  /** How many regular monster steps stand between entering the dungeon and
   * the boss, per tier (loot-system follow-up) — the user's own "1 or 3 or
   * 5" list mapped onto the 3 existing tiers. */
  stepsPerTier: { 1: 1, 2: 3, 3: 5 } as const,
  normalDailyAttempts: 1,
  vipDailyAttempts: 2,
  /** The Growl's break-percentage roll range (loot-system follow-up):
   * always rolled on boss reveal, breaking 0-50% of remaining POTs. */
  growlBreakPercentMax: 50,
} as const;
