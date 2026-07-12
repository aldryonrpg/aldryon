import { describe, expect, it } from "bun:test";
import { computeDamage } from "@/domain/battle/services/DamageCalculator";

describe("DamageCalculator", () => {
  it("computes attack_value + stamina_cost - defense_value", () => {
    // attackValue = 1.5 * 20 = 30; +10 stamina = 40; defense = 2 * 10 = 20 -> damage 20
    const damage = computeDamage({
      attackMultiplier: 1.5,
      attackerScalingValue: 20,
      staminaCost: 10,
      defenderLevel: 2,
      defenderScalingValue: 10,
    });
    expect(damage).toBe(20);
  });

  it("clamps damage at 0 when defense exceeds offense", () => {
    const damage = computeDamage({
      attackMultiplier: 0.4,
      attackerScalingValue: 5,
      staminaCost: 0,
      defenderLevel: 50,
      defenderScalingValue: 50,
    });
    expect(damage).toBe(0);
  });

  it("HIT's 0 stamina cost adds nothing to the attack value", () => {
    const withZeroCost = computeDamage({
      attackMultiplier: 0.4,
      attackerScalingValue: 10,
      staminaCost: 0,
      defenderLevel: 1,
      defenderScalingValue: 0,
    });
    expect(withZeroCost).toBe(0.4 * 10);
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
});
