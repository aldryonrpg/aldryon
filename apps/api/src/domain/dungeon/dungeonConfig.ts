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
   * materialized boss monsters row per tier (plan3 §2c's table). */
  tierBossLevel: { 1: 10, 2: 15, 3: 20 } as const,
  normalDailyAttempts: 1,
  vipDailyAttempts: 2,
  /** The Growl's awakening roll (plan3 §2e). */
  growlChancePercent: 50,
} as const;
