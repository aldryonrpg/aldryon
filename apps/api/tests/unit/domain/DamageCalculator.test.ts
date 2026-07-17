import { describe, expect, it } from "bun:test";
import { computeDamage } from "@/domain/battle/services/DamageCalculator";

describe("DamageCalculator", () => {
  it("computes attack_value + stamina_cost - defense_value", () => {
    // attackValue = 1.5 * 20 = 30; +10 stamina = 40;
    // defense = (2-1) * 10 / 2 = 5 -> damage 35
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
    // attackValue = 1 * 10 = 10; defenseValue = (3-1) * 2.5 / 2 = 2.5 -> ceil to 3 -> damage 7
    const damage = computeDamage({
      attackMultiplier: 1,
      attackerScalingValue: 10,
      staminaCost: 0,
      defenderLevel: 3,
      defenderScalingValue: 2.5,
    });
    expect(damage).toBe(7);
  });

  it("a level-1 defender has zero defense from this term (level - 1 == 0)", () => {
    const damage = computeDamage({
      attackMultiplier: 1,
      attackerScalingValue: 5,
      staminaCost: 0,
      defenderLevel: 1,
      defenderScalingValue: 1000,
    });
    expect(damage).toBe(5);
  });
});
