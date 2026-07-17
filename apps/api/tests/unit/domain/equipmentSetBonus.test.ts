import { describe, expect, it } from "bun:test";
import { computeSetBonus } from "@/domain/player/equipmentSetBonus";

const SLOTS = ["helmet", "body", "boots", "gloves", "necklace", "bracelet"];

function fullSet(setName: string) {
  return SLOTS.map((slot) => ({ slot, setName }));
}

describe("computeSetBonus", () => {
  it("grants the flat attributeBonus to every attribute for a complete set", () => {
    const bonus = computeSetBonus(fullSet("leather"), 2);
    expect(bonus).toEqual({
      strength: 2,
      dexterity: 2,
      agility: 2,
      intelligence: 2,
      vitality: 2,
      luck: 2,
    });
  });

  it("is the SAME flat value regardless of which tier's set is completed", () => {
    // Regression: the completion bonus must never scale by tier — only each
    // set's individual per-piece item bonuses do. leather/iron/silver/gold/
    // platinum should all report the identical completion bonus.
    const leather = computeSetBonus(fullSet("leather"), 2);
    const iron = computeSetBonus(fullSet("iron"), 2);
    const silver = computeSetBonus(fullSet("silver"), 2);
    const gold = computeSetBonus(fullSet("gold"), 2);
    const platinum = computeSetBonus(fullSet("platinum"), 2);

    expect(iron).toEqual(leather);
    expect(silver).toEqual(leather);
    expect(gold).toEqual(leather);
    expect(platinum).toEqual(leather);
  });

  it("grants no bonus at all when the set is incomplete (5 of 6)", () => {
    const pieces = fullSet("iron").slice(0, 5);
    const bonus = computeSetBonus(pieces, 2);
    expect(bonus).toEqual({
      strength: 0,
      dexterity: 0,
      agility: 0,
      intelligence: 0,
      vitality: 0,
      luck: 0,
    });
  });
});
