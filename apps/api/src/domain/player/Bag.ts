import { BATTLE_CONFIG } from "@/domain/battle/battleConfig";

/**
 * Bag capacity rules (plan2 §3d/§10). Two kinds of bag storage:
 *  - "normal" stacks (gear + POTs): 20 slots (25 for VIP), each stack up to 5.
 *  - "special" stacks (bandage, antidote): exactly 2 dedicated slots outside
 *    capacity, one per item, each up to 5.
 * Equipped gear never counts toward either. This module is a pure
 * calculator over a caller-supplied snapshot — it doesn't know about the
 * item catalog (which items are "special" is a name-based catalog fact the
 * usecase resolves before calling in).
 */
/** The exactly-2 special-slot items by catalog name (plan2 §3d/§10). */
export const SPECIAL_SLOT_ITEM_NAMES: readonly string[] = ["bandage", "antidote"];

export interface BagStackSnapshot {
  playerItemId: string;
  itemId: string;
  quantity: number;
}

export interface NormalBagSnapshot {
  /** Unequipped, non-special stacks only. */
  slots: BagStackSnapshot[];
  isVip: boolean;
}

export function normalBagCapacity(isVip: boolean): number {
  return isVip ? BATTLE_CONFIG.bagCapacityVip : BATTLE_CONFIG.bagCapacityNormal;
}

export interface AddNormalItemPlan {
  fits: boolean;
  /** Existing stack to top up; null means a brand-new slot is needed (and available). */
  targetPlayerItemId: string | null;
  reason?: string;
}

/** Plans adding one unit of `itemId` into the normal (capacity-limited) bag. */
export function planAddNormalItem(snapshot: NormalBagSnapshot, itemId: string): AddNormalItemPlan {
  const existingWithRoom = snapshot.slots.find(
    (slot) => slot.itemId === itemId && slot.quantity < BATTLE_CONFIG.bagStackMax,
  );
  if (existingWithRoom) {
    return { fits: true, targetPlayerItemId: existingWithRoom.playerItemId };
  }
  if (snapshot.slots.length < normalBagCapacity(snapshot.isVip)) {
    return { fits: true, targetPlayerItemId: null };
  }
  return { fits: false, targetPlayerItemId: null, reason: "Bag is full" };
}

export interface AddSpecialItemPlan {
  fits: boolean;
  reason?: string;
}

/** Plans adding one unit into a special slot (bandage/antidote) given its current stack quantity (0 if none yet). */
export function planAddSpecialItem(currentQuantity: number): AddSpecialItemPlan {
  if (currentQuantity < BATTLE_CONFIG.specialSlotMax) {
    return { fits: true };
  }
  return { fits: false, reason: "Special slot is full (max 5)" };
}
