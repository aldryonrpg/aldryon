import { describe, expect, it } from "bun:test";
import { dungeonTierForPlayerLevel } from "@/domain/dungeon/dungeonTierForPlayerLevel";

describe("dungeonTierForPlayerLevel", () => {
  it("maps levels 10-14 to tier 1", () => {
    expect(dungeonTierForPlayerLevel(10)).toBe(1);
    expect(dungeonTierForPlayerLevel(12)).toBe(1);
    expect(dungeonTierForPlayerLevel(14)).toBe(1);
  });

  it("maps levels 15-19 to tier 2", () => {
    expect(dungeonTierForPlayerLevel(15)).toBe(2);
    expect(dungeonTierForPlayerLevel(17)).toBe(2);
    expect(dungeonTierForPlayerLevel(19)).toBe(2);
  });

  it("maps level 20 and above to tier 3 (no tier 4 to grow into)", () => {
    expect(dungeonTierForPlayerLevel(20)).toBe(3);
    expect(dungeonTierForPlayerLevel(35)).toBe(3);
  });

  it("lands the 14->15 and 19->20 boundaries on the correct side", () => {
    expect(dungeonTierForPlayerLevel(14)).toBe(1);
    expect(dungeonTierForPlayerLevel(15)).toBe(2);
    expect(dungeonTierForPlayerLevel(19)).toBe(2);
    expect(dungeonTierForPlayerLevel(20)).toBe(3);
  });

  it("throws below the minimum dungeon level", () => {
    expect(() => dungeonTierForPlayerLevel(9)).toThrow();
    expect(() => dungeonTierForPlayerLevel(1)).toThrow();
  });
});
