import { describe, expect, it } from "bun:test";
import { scaleDungeonBossStats } from "@/domain/dungeon/scaleDungeonBossStats";

const BASE_ATTRIBUTES = {
  force: 20,
  dexterity: 20,
  agility: 20,
  intelligence: 50,
  vitality: 20,
  luck: 20,
};

describe("scaleDungeonBossStats", () => {
  it("tier 1 returns the base unchanged", () => {
    const result = scaleDungeonBossStats(
      { hp: 2000, xpGain: 5000, attributes: BASE_ATTRIBUTES },
      1,
    );
    expect(result).toEqual({ hp: 2000, xpGain: 5000, attributes: BASE_ATTRIBUTES });
  });

  it("tier 2 applies a 150% multiplier", () => {
    const result = scaleDungeonBossStats(
      { hp: 2000, xpGain: 5000, attributes: BASE_ATTRIBUTES },
      2,
    );
    expect(result.hp).toBe(3000);
    expect(result.xpGain).toBe(7500);
    expect(result.attributes.intelligence).toBe(75);
    expect(result.attributes.force).toBe(30);
  });

  it("tier 3 applies a 200% multiplier", () => {
    const result = scaleDungeonBossStats(
      { hp: 2000, xpGain: 5000, attributes: BASE_ATTRIBUTES },
      3,
    );
    expect(result.hp).toBe(4000);
    expect(result.xpGain).toBe(10000);
    expect(result.attributes.intelligence).toBe(100);
  });

  it("rounds a fractional result up, never down (a fractional base x1.5)", () => {
    const result = scaleDungeonBossStats(
      { hp: 2001, xpGain: 5001, attributes: { ...BASE_ATTRIBUTES, luck: 21 } },
      2,
    );
    // 2001 * 1.5 = 3001.5 -> ceil to 3002
    expect(result.hp).toBe(3002);
    // 5001 * 1.5 = 7501.5 -> ceil to 7502
    expect(result.xpGain).toBe(7502);
    // 21 * 1.5 = 31.5 -> ceil to 32
    expect(result.attributes.luck).toBe(32);
  });
});
