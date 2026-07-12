export interface LevelRow {
  level: number;
  xpRequired: number;
}

/** A player's level is the highest level whose xp_required <= xp (plan2 §3g). */
export function levelForXp(levels: LevelRow[], xp: number): number {
  let result = 1;
  for (const row of levels) {
    if (row.xpRequired <= xp) {
      result = Math.max(result, row.level);
    }
  }
  return result;
}

export interface ApplyXpGainInput {
  levels: LevelRow[];
  currentXp: number;
  currentLevel: number;
  xpGain: number;
  maxXp: number;
  attributePointsPerLevel: number;
}

export interface ApplyXpGainResult {
  xp: number;
  level: number;
  attributePointsGained: number;
}

/**
 * Awards XP (clamped at the cap), recomputes level from the curve, and
 * grants attributePointsPerLevel for each level gained (plan2 §6b).
 */
export function applyXpGain(input: ApplyXpGainInput): ApplyXpGainResult {
  const xp = Math.min(input.maxXp, input.currentXp + input.xpGain);
  const level = levelForXp(input.levels, xp);
  const levelsGained = Math.max(0, level - input.currentLevel);
  return { xp, level, attributePointsGained: levelsGained * input.attributePointsPerLevel };
}

export interface ApplyDeathPenaltyInput {
  levels: LevelRow[];
  currentXp: number;
  deathXpPenaltyRate: number;
}

export interface ApplyDeathPenaltyResult {
  xp: number;
  level: number;
}

/** Dying costs 1% of total XP, which can de-level the player (plan2 §6b). */
export function applyDeathPenalty(input: ApplyDeathPenaltyInput): ApplyDeathPenaltyResult {
  const xp = Math.floor(input.currentXp * (1 - input.deathXpPenaltyRate));
  const level = levelForXp(input.levels, xp);
  return { xp, level };
}
