import { describe, expect, it } from "bun:test";
import {
  bumpAttackWeights,
  selectByWeightedDamage,
} from "@/domain/battle/services/MonsterAttackAi";
import { MonsterAttack } from "@/domain/monster/MonsterAttack";

function attack(id: string, overrides: { isSpecial?: boolean } = {}): MonsterAttack {
  return MonsterAttack.create({
    id,
    name: `Attack ${id}`,
    staminaCost: 0,
    multiplier: 1,
    scalingAttribute: "force",
    appliesEffect: null,
    isSpecial: overrides.isSpecial ?? false,
    chargeTurns: overrides.isSpecial ? 1 : 0,
  });
}

describe("selectByWeightedDamage", () => {
  it("picks the highest raw damage when no weight has accumulated", () => {
    const weak = attack("weak");
    const strong = attack("strong");
    const chosen = selectByWeightedDamage(
      [
        { attack: weak, damage: 5 },
        { attack: strong, damage: 10 },
      ],
      {},
    );
    expect(chosen.id).toBe("strong");
  });

  it("a long-unused weaker attack can outscore a frequently-picked stronger one", () => {
    const weak = attack("weak");
    const strong = attack("strong");
    const chosen = selectByWeightedDamage(
      [
        { attack: weak, damage: 5 },
        { attack: strong, damage: 10 },
      ],
      { weak: 8 }, // 5 + 8 = 13 > 10 + 0
    );
    expect(chosen.id).toBe("weak");
  });

  it("treats a missing weight entry as 0", () => {
    const a = attack("a");
    const b = attack("b");
    const chosen = selectByWeightedDamage(
      [
        { attack: a, damage: 3 },
        { attack: b, damage: 3 },
      ],
      { a: 1 },
    );
    expect(chosen.id).toBe("a");
  });

  it("throws on an empty candidate list", () => {
    expect(() => selectByWeightedDamage([], {})).toThrow();
  });
});

describe("bumpAttackWeights", () => {
  it("resets the picked attack to 0 and increments every other non-special attack", () => {
    const a = attack("a");
    const b = attack("b");
    const next = bumpAttackWeights({ a: 3, b: 5 }, [a, b], "a");
    expect(next).toEqual({ a: 0, b: 6 });
  });

  it("increments everything when nothing was picked (rested or charged a special)", () => {
    const a = attack("a");
    const b = attack("b");
    const next = bumpAttackWeights({ a: 0, b: 2 }, [a, b], null);
    expect(next).toEqual({ a: 1, b: 3 });
  });

  it("bumps an unaffordable attack too, even though it wasn't a real candidate this turn", () => {
    const a = attack("a");
    const unaffordable = attack("unaffordable");
    // Caller passes the full moveset here, not just the affordable subset.
    const next = bumpAttackWeights({}, [a, unaffordable], "a");
    expect(next).toEqual({ a: 0, unaffordable: 1 });
  });

  it("never includes special attacks in the weights map", () => {
    const normal = attack("normal");
    const special = attack("special", { isSpecial: true });
    const next = bumpAttackWeights({}, [normal, special], null);
    expect(next).toEqual({ normal: 1 });
  });

  it("starts a brand-new attack (no prior entry) at weight 1 when not picked", () => {
    const a = attack("a");
    const next = bumpAttackWeights({}, [a], null);
    expect(next).toEqual({ a: 1 });
  });
});
