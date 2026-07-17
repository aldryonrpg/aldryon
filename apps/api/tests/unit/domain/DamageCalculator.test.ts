import { describe, expect, it } from "bun:test";
import { computeDamage } from "@/domain/battle/services/DamageCalculator";

describe("DamageCalculator", () => {
  it("computes attack_value + stamina_cost - defense_value", () => {
    // attackValue = 1.5 * 20 = 30; +10 stamina = 40;
    // defense = floor(3/2)=1 * 10 / 2 = 5 -> damage 35
    const damage = computeDamage({
      attackMultiplier: 1.5,
      attackerScalingValue: 20,
      staminaCost: 10,
      defenderLevel: 2,
      defenderScalingValue: 10,
    });
    expect(damage).toBe(35);
  });

  it("floors damage at 1 when defense vastly exceeds offense", () => {
    const damage = computeDamage({
      attackMultiplier: 0.4,
      attackerScalingValue: 5,
      staminaCost: 0,
      defenderLevel: 50,
      defenderScalingValue: 50,
    });
    expect(damage).toBe(1);
  });

  it("a 0 stamina cost adds nothing to the attack value", () => {
    const withZeroCost = computeDamage({
      attackMultiplier: 0.4,
      attackerScalingValue: 10,
      staminaCost: 0,
      defenderLevel: 1,
      defenderScalingValue: 0,
    });
    expect(withZeroCost).toBe(Math.ceil(0.4 * 10));
  });

  it("stamina cost is added, not multiplied", () => {
    const damage = computeDamage({
      attackMultiplier: 2,
      attackerScalingValue: 10,
      staminaCost: 50,
      defenderLevel: 1,
      defenderScalingValue: 0,
    });
    expect(damage).toBe(2 * 10 + 50);
  });

  it("rounds a fractional attack value up, never down", () => {
    // attackValue = 0.4 * 7 = 2.8 -> ceil to 3
    const damage = computeDamage({
      attackMultiplier: 0.4,
      attackerScalingValue: 7,
      staminaCost: 0,
      defenderLevel: 1,
      defenderScalingValue: 0,
    });
    expect(damage).toBe(3);
  });

  it("rounds a fractional defense value up, never down (favors the defender less)", () => {
    // attackValue = 1 * 10 = 10; defenseValue = floor(4/2)=2 * 2.5 / 2 = 2.5 -> ceil to 3 -> damage 7
    const damage = computeDamage({
      attackMultiplier: 1,
      attackerScalingValue: 10,
      staminaCost: 0,
      defenderLevel: 3,
      defenderScalingValue: 2.5,
    });
    expect(damage).toBe(7);
  });

  it("a level-1 defender still has a small defense term (floor[(1+1)/2] == 1)", () => {
    // attackValue = 1 * 1000 = 1000; defenseValue = floor(2/2)=1 * 5 / 2 = 2.5 -> ceil to 3
    const damage = computeDamage({
      attackMultiplier: 1,
      attackerScalingValue: 1000,
      staminaCost: 0,
      defenderLevel: 1,
      defenderScalingValue: 5,
    });
    expect(damage).toBe(1000 - 3);
  });

  it("level 1 and level 2 defenders share the same defense term (floor rounds both down to 1)", () => {
    const base = {
      attackMultiplier: 1,
      attackerScalingValue: 1000,
      staminaCost: 0,
      defenderScalingValue: 10,
    };
    const level1 = computeDamage({ ...base, defenderLevel: 1 });
    const level2 = computeDamage({ ...base, defenderLevel: 2 });
    expect(level1).toBe(level2);
  });
});
