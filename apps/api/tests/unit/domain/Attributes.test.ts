import { describe, expect, it } from "bun:test";
import { Attributes } from "@/domain/shared/Attributes";

describe("Attributes", () => {
  it("creates fighter attributes at the default of 1", () => {
    const attrs = Attributes.create({
      strength: 1,
      dexterity: 1,
      agility: 1,
      intelligence: 1,
      vitality: 1,
      luck: 1,
    });
    expect(attrs.strength).toBe(1);
    expect(attrs.luck).toBe(1);
  });

  it("rejects a fighter attribute below 1", () => {
    expect(() =>
      Attributes.create({
        strength: 0,
        dexterity: 1,
        agility: 1,
        intelligence: 1,
        vitality: 1,
        luck: 1,
      }),
    ).toThrow();
  });

  it("rejects a non-integer attribute", () => {
    expect(() =>
      Attributes.create({
        strength: 1.5,
        dexterity: 1,
        agility: 1,
        intelligence: 1,
        vitality: 1,
        luck: 1,
      }),
    ).toThrow();
  });

  it("computes effective attributes as base + bonuses", () => {
    const base = Attributes.create({
      strength: 10,
      dexterity: 10,
      agility: 10,
      intelligence: 10,
      vitality: 10,
      luck: 10,
    });
    const effective = base.withBonuses({ strength: 5, luck: -2 });
    expect(effective.strength).toBe(15);
    expect(effective.luck).toBe(8);
    expect(effective.dexterity).toBe(10);
  });

  it("floors effective attributes at 1 even when item bonuses are very negative", () => {
    const base = Attributes.create({
      strength: 3,
      dexterity: 1,
      agility: 1,
      intelligence: 1,
      vitality: 1,
      luck: 1,
    });
    const effective = base.withBonuses({ strength: -10 });
    expect(effective.strength).toBe(1);
  });
});
