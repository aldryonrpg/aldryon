import { describe, expect, it } from "bun:test";
import { maxHp, maxStamina } from "@/domain/battle/battleConfig";

describe("battleConfig formulas", () => {
  it("max HP = 100 + 10*Vitality + 1*Force", () => {
    expect(maxHp(10, 5)).toBe(100 + 10 * 10 + 1 * 5);
  });

  it("max HP at the attribute floor of 1/1", () => {
    expect(maxHp(1, 1)).toBe(111);
  });

  it("max Stamina starts at 25 for level 1", () => {
    expect(maxStamina(1)).toBe(25);
  });

  it("max Stamina adds 5 per level", () => {
    expect(maxStamina(5)).toBe(20 + 5 * 5);
  });

  it("max Stamina caps at 100, reached at level 16", () => {
    expect(maxStamina(16)).toBe(100);
    expect(maxStamina(20)).toBe(100);
  });
});
