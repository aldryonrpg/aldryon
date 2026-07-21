import type { MonsterRegion } from "@/domain/monster/Monster";

/**
 * Pure game-rule constants (plan2 §4/§5/§6/§6a/§6b). No `process.env` here —
 * the domain never touches configuration I/O (CLAUDE.md's dependency rule).
 * The env knobs (LEVEL_UP_ATTRIBUTE_POINTS, MOUNTAIN_LEVEL_REQUIREMENT,
 * RUINS_LEVEL_REQUIREMENT, ...) are read in infrastructure/config and passed
 * into usecases as parameters instead.
 */
export const BATTLE_CONFIG = {
  /** 20% of /battle/start calls find nothing (plan2 §4 step 2). */
  emptyEncounterChance: 0.2,
  /** Hit-check roll bounds (plan2 §6) — a hit chance below this floor is a
   * guaranteed miss, since the roll can never come in low enough to match it. */
  hitRollMin: 10,
  hitRollMax: 100,
  /** Effect-proc roll bounds (plan2 §6a) — separate from the hit-check
   * bounds above so tuning one never silently changes the other. An effect
   * can never land below this floor's Luck lead (attackerLuck - defenderLuck). */
  effectProcRollMin: 5,
  effectProcRollMax: 100,
  /** Both sides recover this passively at the end of every round. */
  passiveStaminaRegen: 5,
  /** Rest (and monster charge/rest turns) recover this instead. */
  restStaminaRegen: 15,
  /** Run cooldown after a successful flee (plan2 §4 step 1a). */
  runCooldownSeconds: 30,
  runCooldownSecondsVip: 15,
  /** XP cap and death penalty (plan2 §6b). */
  maxXp: 1_000_000,
  deathXpPenaltyRate: 0.01,
  maxLevel: 20,
  /** Bag capacity (plan2 §3d). */
  bagCapacityNormal: 20,
  bagCapacityVip: 25,
  bagStackMax: 5,
  specialSlotMax: 5,
  /** Max HP = 100 + 10*Vitality + 1*Strength (plan2 §3a). */
  baseMaxHp: 100,
  maxHpPerVitality: 10,
  maxHpPerStrength: 1,
  /** Max Stamina = min(100, 20 + 5*level) (plan2 §3a). */
  baseMaxStamina: 20,
  maxStaminaPerLevel: 5,
  maxStaminaCap: 100,
  /** New players start with 10 attribute points (plan2 §3a). */
  startingAttributePoints: 10,
  defaultLevelUpAttributePoints: 4,
} as const;

export const EMPTY_ENCOUNTER_FLAVOR: readonly string[] = [
  "You wander the moors of Aldryon and find only wind.",
  "The path is quiet today — nothing stirs.",
  "You search the region but find no trace of anything alive.",
  "Only birdsong and rustling leaves greet you here.",
  "You find tracks, but whatever made them is long gone.",
  "The region feels strangely empty, as if holding its breath.",
  "Not even a shadow moves. You press on.",
  "A cold wind passes, but nothing else does.",
];

export const AMBUSH_FLAVOR: readonly string[] = [
  "You trip and stumble right into it!",
  "You bump into it before you even see it coming.",
  "It was waiting — and it strikes before you can react.",
];

export const CHARGE_WARNING_FLAVOR: readonly string[] = [
  "The monster is preparing something...",
  "The monster is channeling...",
  "The monster stopped and is glowing, be careful...",
];

export function maxHp(vitality: number, strength: number): number {
  return (
    BATTLE_CONFIG.baseMaxHp +
    BATTLE_CONFIG.maxHpPerVitality * vitality +
    BATTLE_CONFIG.maxHpPerStrength * strength
  );
}

export function maxStamina(level: number): number {
  return Math.min(
    BATTLE_CONFIG.maxStaminaCap,
    BATTLE_CONFIG.baseMaxStamina + BATTLE_CONFIG.maxStaminaPerLevel * level,
  );
}

/** forest/bandit/sewage are open from level 1 — only mountain/ruins are
 * level-gated, at env-configurable thresholds (MOUNTAIN_LEVEL_REQUIREMENT/
 * RUINS_LEVEL_REQUIREMENT). "dungeon" never reaches here — it's not a
 * `/battle/start`-selectable region (see MonsterRegionSchema). */
export function minimumLevelForRegion(
  region: MonsterRegion,
  mountainLevelRequirement: number,
  ruinsLevelRequirement: number,
): number {
  switch (region) {
    case "mountain":
      return mountainLevelRequirement;
    case "ruins":
      return ruinsLevelRequirement;
    default:
      return 1;
  }
}
