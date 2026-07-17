import { describe, expect, it } from "bun:test";
import type { BattleEffect } from "@/domain/battle/BattleEffect";
import {
  addBattleEffect,
  applyStatDebuffs,
  buildBattleEffect,
  computeDotMagnitude,
  consumeStunTurn,
  isStunned,
  removeDotByCounterItem,
  statDebuffPercent,
  tickEffects,
  toBattleEffectView,
} from "@/domain/battle/BattleEffect";
import { Attributes } from "@/domain/shared/Attributes";

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

describe("buildBattleEffect", () => {
  it("builds a DoT for bleed/poison/burn with a snapshotted magnitude", () => {
    const effect = buildBattleEffect("poison", {
      inflictorLevel: 5,
      victimLevel: 3,
      counterItemId: "antidote-id",
    });
    expect(effect).toEqual({
      type: "dot",
      kind: "poison",
      damagePerRound: 4,
      counterItemId: "antidote-id",
    });
  });

  it("builds a Fear stat-debuff targeting Strength, starting at roundsElapsed 0", () => {
    const effect = buildBattleEffect("fear", {
      inflictorLevel: 5,
      victimLevel: 3,
      counterItemId: null,
    });
    expect(effect).toEqual({ type: "debuff", kind: "fear", stat: "strength", roundsElapsed: 0 });
  });

  it("builds a Magic Aura Blast stat-debuff targeting Intelligence", () => {
    const effect = buildBattleEffect("magic_aura_blast", {
      inflictorLevel: 5,
      victimLevel: 3,
      counterItemId: null,
    });
    expect(effect).toEqual({
      type: "debuff",
      kind: "magic_aura_blast",
      stat: "intelligence",
      roundsElapsed: 0,
    });
  });

  it("builds a Stun that starts at 2 turns", () => {
    const effect = buildBattleEffect("stun", {
      inflictorLevel: 5,
      victimLevel: 3,
      counterItemId: null,
    });
    expect(effect).toEqual({ type: "stun", roundsLeft: 2 });
  });
});

describe("addBattleEffect", () => {
  const params = { inflictorLevel: 5, victimLevel: 3, counterItemId: null };

  it("stacks a DoT — appends a new instance even if the same kind is already active", () => {
    const effects: BattleEffect[] = [
      { type: "dot", kind: "bleed", damagePerRound: 3, counterItemId: null },
    ];
    const result = addBattleEffect(effects, "bleed", params);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(effects[0] as BattleEffect);
  });

  it("adds a fresh Fear debuff when none is active yet", () => {
    const result = addBattleEffect([], "fear", params);
    expect(result).toEqual([{ type: "debuff", kind: "fear", stat: "strength", roundsElapsed: 0 }]);
  });

  it("refreshes an already-active Fear debuff back to roundsElapsed 0 instead of stacking", () => {
    const effects: BattleEffect[] = [
      { type: "debuff", kind: "fear", stat: "strength", roundsElapsed: 4 },
    ];
    const result = addBattleEffect(effects, "fear", params);
    expect(result).toHaveLength(1);
    expect(result).toEqual([{ type: "debuff", kind: "fear", stat: "strength", roundsElapsed: 0 }]);
  });

  it("refreshes an already-active Magic Aura Blast debuff the same way", () => {
    const effects: BattleEffect[] = [
      { type: "debuff", kind: "magic_aura_blast", stat: "intelligence", roundsElapsed: 2 },
    ];
    const result = addBattleEffect(effects, "magic_aura_blast", params);
    expect(result).toHaveLength(1);
    expect(result).toEqual([
      { type: "debuff", kind: "magic_aura_blast", stat: "intelligence", roundsElapsed: 0 },
    ]);
  });

  it("doesn't refresh a Fear debuff when only a different-kind debuff is active", () => {
    const effects: BattleEffect[] = [
      { type: "debuff", kind: "magic_aura_blast", stat: "intelligence", roundsElapsed: 3 },
    ];
    const result = addBattleEffect(effects, "fear", params);
    expect(result).toHaveLength(2);
  });

  it("appends Stun rather than refreshing (de-duplication isn't its job — the AI cooldown is)", () => {
    const effects: BattleEffect[] = [{ type: "stun", roundsLeft: 1 }];
    const result = addBattleEffect(effects, "stun", params);
    expect(result).toHaveLength(2);
  });
});

describe("toBattleEffectView", () => {
  it("passes a DoT through unchanged", () => {
    const effect: BattleEffect = {
      type: "dot",
      kind: "poison",
      damagePerRound: 4,
      counterItemId: null,
    };
    expect(toBattleEffectView(effect)).toEqual(effect);
  });

  it("passes a Stun through unchanged", () => {
    const effect: BattleEffect = { type: "stun", roundsLeft: 2 };
    expect(toBattleEffectView(effect)).toEqual(effect);
  });

  it("adds the current percent to a stat-debuff, computed from roundsElapsed", () => {
    const effect: BattleEffect = {
      type: "debuff",
      kind: "fear",
      stat: "strength",
      roundsElapsed: 3,
    };
    expect(toBattleEffectView(effect)).toEqual({ ...effect, percent: 30 });
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

  it("stacks unlimited instances of the same DoT kind — each ticks its own damage", () => {
    const effects: BattleEffect[] = [
      { type: "dot", kind: "bleed", damagePerRound: 3, counterItemId: "bandage-id" },
      { type: "dot", kind: "bleed", damagePerRound: 3, counterItemId: "bandage-id" },
      { type: "dot", kind: "bleed", damagePerRound: 3, counterItemId: "bandage-id" },
    ];
    const { totalDamage, remaining } = tickEffects(effects);
    expect(totalDamage).toBe(9);
    expect(remaining).toHaveLength(3);
  });

  it("advances a stat-debuff's roundsElapsed and keeps it while the schedule has entries", () => {
    const effects: BattleEffect[] = [
      { type: "debuff", kind: "fear", stat: "strength", roundsElapsed: 0 },
    ];
    const { totalDamage, remaining } = tickEffects(effects);
    expect(totalDamage).toBe(0);
    expect(remaining).toEqual([
      { type: "debuff", kind: "fear", stat: "strength", roundsElapsed: 1 },
    ]);
  });

  it("expires a stat-debuff once its schedule is exhausted", () => {
    const effects: BattleEffect[] = [
      { type: "debuff", kind: "fear", stat: "strength", roundsElapsed: 5 },
    ];
    const { remaining } = tickEffects(effects);
    expect(remaining).toHaveLength(0);
  });

  it("passes a stun through unchanged — it's only consumed by an actual stunned turn", () => {
    const effects: BattleEffect[] = [{ type: "stun", roundsLeft: 2 }];
    const { remaining } = tickEffects(effects);
    expect(remaining).toEqual([{ type: "stun", roundsLeft: 2 }]);
  });
});

describe("removeDotByCounterItem", () => {
  it("clears every stacked instance of a kind in one use of the counter item", () => {
    const effects: BattleEffect[] = [
      { type: "dot", kind: "bleed", damagePerRound: 3, counterItemId: "bandage-id" },
      { type: "dot", kind: "bleed", damagePerRound: 3, counterItemId: "bandage-id" },
      { type: "dot", kind: "poison", damagePerRound: 5, counterItemId: "antidote-id" },
    ];
    const remaining = removeDotByCounterItem(effects, "bandage-id");
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toMatchObject({ kind: "poison" });
  });
});

describe("statDebuffPercent", () => {
  it("holds at 50% for the first 2 rounds, then decays 10 points a round", () => {
    expect(statDebuffPercent(0)).toBe(50);
    expect(statDebuffPercent(1)).toBe(50);
    expect(statDebuffPercent(2)).toBe(40);
    expect(statDebuffPercent(3)).toBe(30);
    expect(statDebuffPercent(4)).toBe(20);
    expect(statDebuffPercent(5)).toBe(10);
  });

  it("is 0 (normal) once the schedule is exhausted", () => {
    expect(statDebuffPercent(6)).toBe(0);
    expect(statDebuffPercent(100)).toBe(0);
  });
});

describe("isStunned / consumeStunTurn", () => {
  it("reports stunned while roundsLeft > 0", () => {
    expect(isStunned([{ type: "stun", roundsLeft: 2 }])).toBe(true);
    expect(isStunned([])).toBe(false);
  });

  it("consumes exactly one stunned turn per call, expiring at 0", () => {
    let effects: BattleEffect[] = [{ type: "stun", roundsLeft: 2 }];
    effects = consumeStunTurn(effects);
    expect(isStunned(effects)).toBe(true);
    expect(effects).toEqual([{ type: "stun", roundsLeft: 1 }]);

    effects = consumeStunTurn(effects);
    expect(isStunned(effects)).toBe(false);
    expect(effects).toHaveLength(0);
  });
});

describe("applyStatDebuffs", () => {
  const base = Attributes.create({
    strength: 20,
    dexterity: 10,
    agility: 10,
    intelligence: 20,
    vitality: 10,
    luck: 10,
  });

  it("reduces Strength by the Fear schedule's current percent, floored", () => {
    // 20 * (1 - 0.5) = 10
    const result = applyStatDebuffs(base, [
      { type: "debuff", kind: "fear", stat: "strength", roundsElapsed: 0 },
    ]);
    expect(result.strength).toBe(10);
    expect(result.intelligence).toBe(20);
  });

  it("reduces Intelligence via Magic Aura Blast and floors a fractional result", () => {
    // 20 * (1 - 0.3) = 14 exactly at roundsElapsed 3 (30%)
    const result = applyStatDebuffs(base, [
      { type: "debuff", kind: "magic_aura_blast", stat: "intelligence", roundsElapsed: 3 },
    ]);
    expect(result.intelligence).toBe(14);
  });

  it("never drops the debuffed stat below the fighter floor of 1", () => {
    const low = Attributes.create({
      strength: 1,
      dexterity: 1,
      agility: 1,
      intelligence: 1,
      vitality: 1,
      luck: 1,
    });
    const result = applyStatDebuffs(low, [
      { type: "debuff", kind: "fear", stat: "strength", roundsElapsed: 0 },
    ]);
    expect(result.strength).toBe(1);
  });

  it("ignores DoT and stun effects entirely", () => {
    const result = applyStatDebuffs(base, [
      { type: "dot", kind: "poison", damagePerRound: 5, counterItemId: null },
      { type: "stun", roundsLeft: 2 },
    ]);
    expect(result.strength).toBe(20);
    expect(result.intelligence).toBe(20);
  });
});
