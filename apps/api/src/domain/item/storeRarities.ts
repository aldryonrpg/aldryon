import type { ItemRarity } from "@/domain/item/Item";

/** The store only sells basic/common/uncommon items — rare and above never
 * appear there (plan3 Store follow-up). */
export const STORE_SELLABLE_RARITIES: readonly ItemRarity[] = ["basic", "common", "uncommon"];

export function isStorePurchasable(rarity: ItemRarity): boolean {
  return STORE_SELLABLE_RARITIES.includes(rarity);
}
