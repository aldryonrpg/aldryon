import { describe, expect, it } from "bun:test";
import type { BattleEffect } from "@/domain/battle/BattleEffect";
import { computeDotMagnitude, tickEffects } from "@/domain/battle/BattleEffect";

describe("computeDotMagnitude", () => {
  it("computes (inflictor_level + 2) - victim_level", () => {
    expect(computeDotMagnitude(5, 3)).toBe(4);
  });

  it("clamps at a minimum of 1 when the victim outlevels the inflictor", () => {
    expect(computeDotMagnitude(1, 20)).toBe(1);
  });

  it("clamps at 1 at the exact break-even point", () => {
    expect(computeDotMagnitude(3, 5)).toBe(1); // (3+2)-5 = 0 -> clamp to 1
  });
});

describe("tickEffects", () => {
  it("sums damage from all DoT effects and keeps them active", () => {
    const effects: BattleEffect[] = [
      { type: "dot", kind: "bleed", damagePerRound: 3, counterItemId: "bandage-id" },
      { type: "dot", kind: "poison", damagePerRound: 5, counterItemId: "antidote-id" },
    ];
    const { totalDamage, remaining } = tickEffects(effects);
    expect(totalDamage).toBe(8);
    expect(remaining).toHaveLength(2);
  });

  it("decrements a debuff's roundsLeft and keeps it while > 0", () => {
    const effects: BattleEffect[] = [{ type: "debuff", stat: "force", amount: 3, roundsLeft: 2 }];
    const { totalDamage, remaining } = tickEffects(effects);
    expect(totalDamage).toBe(0);
    expect(remaining).toEqual([{ type: "debuff", stat: "force", amount: 3, roundsLeft: 1 }]);
  });

  it("expires a debuff once roundsLeft reaches 0", () => {
    const effects: BattleEffect[] = [{ type: "debuff", stat: "force", amount: 3, roundsLeft: 1 }];
    const { remaining } = tickEffects(effects);
    expect(remaining).toHaveLength(0);
  });
});
