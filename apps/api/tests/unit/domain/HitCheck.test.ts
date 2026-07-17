import { describe, expect, it } from "bun:test";
import { computeHitChance, rollHit } from "@/domain/battle/services/HitCheck";
import { FakeRng } from "../support/FakeRng";

describe("HitCheck", () => {
  it("computes hit chance as (attackerDex/defenderAgility)*100 + attackerLuck", () => {
    const chance = computeHitChance({
      attackerDexterity: 10,
      defenderAgility: 10,
      attackerLuck: 5,
    });
    expect(chance).toBe(105);
  });

  it("guarantees a hit when hit chance is exactly 100", () => {
    const hit = rollHit(
      { attackerDexterity: 10, defenderAgility: 10, attackerLuck: 0 },
      new FakeRng([999]), // never consulted
    );
    expect(hit).toBe(true);
  });

  it("guarantees a hit when hit chance is above 100", () => {
    const hit = rollHit(
      { attackerDexterity: 20, defenderAgility: 10, attackerLuck: 5 },
      new FakeRng([999]),
    );
    expect(hit).toBe(true);
  });

  it("hits when the roll is exactly the hit chance", () => {
    // hitChance = (5/10)*100 + 0 = 50
    const hit = rollHit(
      { attackerDexterity: 5, defenderAgility: 10, attackerLuck: 0 },
      new FakeRng([50]),
    );
    expect(hit).toBe(true);
  });

  it("misses when the roll exceeds the hit chance by 1", () => {
    const hit = rollHit(
      { attackerDexterity: 5, defenderAgility: 10, attackerLuck: 0 },
      new FakeRng([51]),
    );
    expect(hit).toBe(false);
  });

  it("hits at the roll floor of 20 when hit chance is very low but >=20", () => {
    const hit = rollHit(
      { attackerDexterity: 2, defenderAgility: 10, attackerLuck: 0 },
      new FakeRng([20]),
    );
    // hitChance = 20
    expect(hit).toBe(true);
  });

  it("hits at the roll ceiling of 100 when hit chance is exactly 100", () => {
    const hit = rollHit(
      { attackerDexterity: 10, defenderAgility: 10, attackerLuck: 0 },
      new FakeRng([100]),
    );
    expect(hit).toBe(true);
  });
});
