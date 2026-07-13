import { describe, expect, it } from "bun:test";
import type { LevelRow } from "@/domain/level/LevelCurve";
import { applyDeathPenalty, applyXpGain, levelForXp } from "@/domain/level/LevelCurve";

const LEVELS: LevelRow[] = [
  { level: 1, xpRequired: 0 },
  { level: 2, xpRequired: 100 },
  { level: 3, xpRequired: 300 },
];

describe("levelForXp", () => {
  it("returns the highest level whose xp_required <= xp", () => {
    expect(levelForXp(LEVELS, 0)).toBe(1);
    expect(levelForXp(LEVELS, 99)).toBe(1);
    expect(levelForXp(LEVELS, 100)).toBe(2);
    expect(levelForXp(LEVELS, 299)).toBe(2);
    expect(levelForXp(LEVELS, 300)).toBe(3);
  });
});

describe("applyXpGain", () => {
  it("awards XP without leveling up when the gain doesn't cross a threshold", () => {
    const result = applyXpGain({
      levels: LEVELS,
      currentXp: 0,
      currentLevel: 1,
      xpGain: 50,
      maxXp: 1_000_000,
      attributePointsPerLevel: 4,
    });
    expect(result).toEqual({ xp: 50, level: 1, attributePointsGained: 0 });
  });

  it("levels up and grants attribute points per level gained", () => {
    const result = applyXpGain({
      levels: LEVELS,
      currentXp: 90,
      currentLevel: 1,
      xpGain: 220, // -> 310 xp, crosses level 2 (100) and level 3 (300)
      maxXp: 1_000_000,
      attributePointsPerLevel: 4,
    });
    expect(result.xp).toBe(310);
    expect(result.level).toBe(3);
    expect(result.attributePointsGained).toBe(8); // 2 levels * 4 points
  });

  it("clamps xp at the cap", () => {
    const result = applyXpGain({
      levels: LEVELS,
      currentXp: 999_990,
      currentLevel: 3,
      xpGain: 100,
      maxXp: 1_000_000,
      attributePointsPerLevel: 4,
    });
    expect(result.xp).toBe(1_000_000);
  });
});

describe("applyDeathPenalty", () => {
  it("removes 1% of total XP", () => {
    const result = applyDeathPenalty({ levels: LEVELS, currentXp: 1000, deathXpPenaltyRate: 0.01 });
    expect(result.xp).toBe(990);
  });

  it("can de-level the player when the penalty crosses a threshold downward", () => {
    const result = applyDeathPenalty({ levels: LEVELS, currentXp: 300, deathXpPenaltyRate: 0.01 });
    expect(result.xp).toBe(297);
    expect(result.level).toBe(2);
  });
});
