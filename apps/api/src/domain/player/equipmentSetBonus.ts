import {
  ATTRIBUTE_KEYS,
  type AttributeValues,
  ZERO_ATTRIBUTE_BONUSES,
} from "@/domain/shared/Attributes";

/** The 6 non-weapon slots a set piece can occupy — weapons/two-handed
 * weapons are never bound to a set. Bracelet and Ring are alternatives for
 * the same physical position, so at most one of them is ever equipped. */
const REQUIRED_SET_SLOTS: readonly string[] = [
  "helmet",
  "body",
  "boots",
  "gloves",
  "necklace",
  "bracelet",
];

export interface EquippedSetPiece {
  slot: string;
  setName: string | null;
}

/**
 * `attributeBonus` (env-configurable, `SET_ATTRIBUTE_BONUS`, default 2) to
 * every attribute when all 6 non-weapon slots are equipped with items
 * sharing the same `setName` — otherwise no bonus at all (no partial credit
 * for 5 of 6 pieces). Since each slot holds at most one item, at most one
 * set can ever be complete at a time. This completion bonus is the same
 * flat value for every tier (Leather through Platinum) — only each set's
 * *individual per-piece* attribute bonuses scale by tier (Iron/Silver 2x,
 * Gold 3x, Platinum 4x the Leather baseline), not this one.
 */
export function computeSetBonus(
  equipped: EquippedSetPiece[],
  attributeBonus: number,
): AttributeValues {
  const setNameBySlot = new Map(equipped.map((item) => [item.slot, item.setName]));
  const first = setNameBySlot.get(REQUIRED_SET_SLOTS[0] as string);
  const isComplete =
    first != null && REQUIRED_SET_SLOTS.every((slot) => setNameBySlot.get(slot) === first);
  if (!isComplete) return { ...ZERO_ATTRIBUTE_BONUSES };

  const bonus = { ...ZERO_ATTRIBUTE_BONUSES };
  for (const key of ATTRIBUTE_KEYS) {
    bonus[key] = attributeBonus;
  }
  return bonus;
}
