import { describe, expect, it } from "bun:test";
import type { AttributeValuesDto } from "@aldryon/dtos";
import { formatAttributeBonuses } from "@/lib/formatAttributeBonuses";

const ZERO: AttributeValuesDto = {
  agility: 0,
  strength: 0,
  intelligence: 0,
  dexterity: 0,
  luck: 0,
  vitality: 0,
};

describe("formatAttributeBonuses", () => {
  it("returns an empty string when every bonus is 0", () => {
    expect(formatAttributeBonuses(ZERO)).toBe("");
  });

  it("formats a single positive bonus with a + sign", () => {
    expect(formatAttributeBonuses({ ...ZERO, strength: 1 })).toBe("Str +1");
  });

  it("formats a negative bonus without an extra sign", () => {
    expect(formatAttributeBonuses({ ...ZERO, vitality: -1 })).toBe("Vit -1");
  });

  it("orders multiple nonzero bonuses Agi/Str/Int/Dex/Sor/Vit regardless of input order", () => {
    expect(
      formatAttributeBonuses({
        ...ZERO,
        vitality: -1,
        agility: 2,
        strength: 1,
      }),
    ).toBe("Agi +2 Str +1 Vit -1");
  });

  it("skips zero entries mixed in among nonzero ones", () => {
    expect(formatAttributeBonuses({ ...ZERO, intelligence: 3, luck: 0 })).toBe("Int +3");
  });
});
