import { describe, expect, it } from "bun:test";
import type { EquipmentPositionDto, EquippedItemsDto } from "@aldryon/dtos";
import { computeSetCompletion } from "@/lib/setCompletion";

const ZERO_BONUSES = {
  agility: 0,
  strength: 0,
  intelligence: 0,
  dexterity: 0,
  luck: 0,
  vitality: 0,
};

function piece(setName: string | null) {
  return {
    playerItemId: "player-item-id",
    itemId: "item-id",
    name: "Test Piece",
    slot: null,
    rarity: "common" as const,
    setName,
    attributeBonuses: ZERO_BONUSES,
  };
}

const EMPTY: EquippedItemsDto = {
  helmet: null,
  body: null,
  boots: null,
  gloves: null,
  necklace: null,
  bracelet: null,
  weapon_1: null,
  weapon_2: null,
};

function equippedWith(
  overrides: Partial<Record<EquipmentPositionDto, string | null>>,
): EquippedItemsDto {
  const equipped = { ...EMPTY };
  for (const [position, setName] of Object.entries(overrides)) {
    equipped[position as EquipmentPositionDto] = setName === null ? null : piece(setName);
  }
  return equipped;
}

describe("computeSetCompletion", () => {
  it("reports neither flag when nothing is equipped", () => {
    expect(computeSetCompletion(EMPTY)).toEqual({
      complete: false,
      almostComplete: false,
      setName: null,
      missingSlotLabel: null,
    });
  });

  it("reports complete once all 6 required slots share the same set", () => {
    const equipped = equippedWith({
      helmet: "dragonSet",
      body: "dragonSet",
      boots: "dragonSet",
      gloves: "dragonSet",
      necklace: "dragonSet",
      bracelet: "dragonSet",
    });

    expect(computeSetCompletion(equipped)).toEqual({
      complete: true,
      almostComplete: false,
      setName: "dragonSet",
      missingSlotLabel: null,
    });
  });

  it("reports almostComplete with the missing slot's label when exactly 5 of 6 match", () => {
    const equipped = equippedWith({
      helmet: "dragonSet",
      body: "dragonSet",
      boots: "dragonSet",
      gloves: "dragonSet",
      necklace: "dragonSet",
      // bracelet left unequipped — the one missing piece.
    });

    expect(computeSetCompletion(equipped)).toEqual({
      complete: false,
      almostComplete: true,
      setName: "dragonSet",
      missingSlotLabel: "Bracelet",
    });
  });

  it("reports neither flag when 4 or fewer pieces match (further from complete)", () => {
    const equipped = equippedWith({
      helmet: "dragonSet",
      body: "dragonSet",
      boots: "dragonSet",
      gloves: "dragonSet",
    });

    const result = computeSetCompletion(equipped);
    expect(result.complete).toBe(false);
    expect(result.almostComplete).toBe(false);
    expect(result.setName).toBe("dragonSet");
  });

  it("picks the set with the most matching pieces when multiple sets are mixed in", () => {
    const equipped = equippedWith({
      helmet: "dragonSet",
      body: "dragonSet",
      boots: "dragonSet",
      gloves: "phoenixSet",
    });

    expect(computeSetCompletion(equipped).setName).toBe("dragonSet");
  });
});
