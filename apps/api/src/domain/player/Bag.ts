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

export interface UnequipStackSnapshot {
  /** An existing unequipped stack of the same item, if one exists. */
  existingStack: { playerItemId: string; quantity: number } | null;
}

export interface UnequipPlan {
  /** The stack to merge the returning unit into, or null if it should
   * become its own new quantity-1 bag row instead (no existing stack, or
   * the existing one is already at bagStackMax). */
  mergeIntoPlayerItemId: string | null;
}

/** Plans returning one equipped unit back to the unequipped bag — the
 * equip-side split's counterpart (equipping from a quantity>1 stack peels
 * off one unit into its own row; unequipping tries to merge that unit back
 * into a same-item stack instead of leaving bag slots fragmented). */
export function planUnequip(snapshot: UnequipStackSnapshot): UnequipPlan {
  if (snapshot.existingStack && snapshot.existingStack.quantity < BATTLE_CONFIG.bagStackMax) {
    return { mergeIntoPlayerItemId: snapshot.existingStack.playerItemId };
  }
  return { mergeIntoPlayerItemId: null };
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

/**
 * The three POT variants (small/medium/big) each still get their own
 * dedicated slot outside normal bag capacity, same as bandage/antidote —
 * but unlike those two, which are independently capped at 5 each, the POTs
 * share ONE combined cap: carrying any mix of the three still only counts
 * once each toward the same running total. The cap itself grows with player
 * level — see `potLimitForLevel` — computed by the usecase and passed in
 * here; this module stays pure and doesn't know about the player.
 */
export const POT_ITEM_NAMES: readonly string[] = ["small pot", "medium pot", "big pot"];

/** The combined POT cap grows with player level (loot-system follow-up):
 * 5 at level 1-4, +1 every 5 levels, topping out at 8 for level 15-20 (the
 * game's own level cap, BATTLE_CONFIG.maxLevel, means there's no bracket
 * past this one). Replaces the old flat POT_LIMIT env var. */
export function potLimitForLevel(level: number): number {
  if (level >= 15) return 8;
  if (level >= 10) return 7;
  if (level >= 5) return 6;
  return 5;
}

export interface AddPotItemPlan {
  fits: boolean;
  reason?: string;
}

/** Plans adding one unit of a POT variant given the CURRENT COMBINED
 * quantity already held across all three POT types (not just this one). */
export function planAddPotItem(currentTotalPotQuantity: number, potLimit: number): AddPotItemPlan {
  if (currentTotalPotQuantity < potLimit) {
    return { fits: true };
  }
  return { fits: false, reason: `POT slot is full (max ${potLimit} combined)` };
}

export interface PotStackSnapshot {
  playerItemId: string;
  /** One of POT_ITEM_NAMES. */
  itemName: string;
  quantity: number;
}

export interface PotBreakResult {
  playerItemId: string;
  /** 0 means this stack is fully broken — the caller should delete the row
   * rather than update it to a zero quantity. */
  newQuantity: number;
}

/**
 * Plans the Growl's POT break (loot-system follow-up): always rolled on
 * boss reveal, breaking `ceil(totalPots * breakPercent / 100)` units total
 * — smallest pot type first (POT_ITEM_NAMES' own small -> medium -> big
 * order), spilling into the next stack once one is fully drained. Returns
 * only the stacks actually touched; an empty array means nothing broke
 * (breakPercent rolled 0, or the player was carrying no POTs at all).
 */
export function planGrowlPotBreak(
  stacks: PotStackSnapshot[],
  breakPercent: number,
): PotBreakResult[] {
  const total = stacks.reduce((sum, stack) => sum + stack.quantity, 0);
  let remaining = Math.ceil((total * breakPercent) / 100);
  if (remaining <= 0) return [];

  const orderedStacks = POT_ITEM_NAMES.flatMap((name) =>
    stacks.filter((stack) => stack.itemName === name),
  );

  const results: PotBreakResult[] = [];
  for (const stack of orderedStacks) {
    if (remaining <= 0) break;
    const brokenFromThisStack = Math.min(stack.quantity, remaining);
    results.push({
      playerItemId: stack.playerItemId,
      newQuantity: stack.quantity - brokenFromThisStack,
    });
    remaining -= brokenFromThisStack;
  }
  return results;
}
