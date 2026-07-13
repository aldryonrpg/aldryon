import { describe, expect, it } from "bun:test";
import { Attributes } from "@/domain/shared/Attributes";

describe("Attributes", () => {
  it("creates fighter attributes at the default of 1", () => {
    const attrs = Attributes.create({
      force: 1,
      dexterity: 1,
      agility: 1,
      intelligence: 1,
      vitality: 1,
      luck: 1,
    });
    expect(attrs.force).toBe(1);
    expect(attrs.luck).toBe(1);
  });

  it("rejects a fighter attribute below 1", () => {
    expect(() =>
      Attributes.create({
        force: 0,
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
        force: 1.5,
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
      force: 10,
      dexterity: 10,
      agility: 10,
      intelligence: 10,
      vitality: 10,
      luck: 10,
    });
    const effective = base.withBonuses({ force: 5, luck: -2 });
    expect(effective.force).toBe(15);
    expect(effective.luck).toBe(8);
    expect(effective.dexterity).toBe(10);
  });

  it("floors effective attributes at 1 even when item bonuses are very negative", () => {
    const base = Attributes.create({
      force: 3,
      dexterity: 1,
      agility: 1,
      intelligence: 1,
      vitality: 1,
      luck: 1,
    });
    const effective = base.withBonuses({ force: -10 });
    expect(effective.force).toBe(1);
  });
});
