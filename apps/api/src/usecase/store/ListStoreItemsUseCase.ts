import type { EquipmentSlot, ItemRarity } from "@/domain/item/Item";
import { ITEM_RARITY_COLORS } from "@/domain/item/itemRarityColors";
import { isStorePurchasable } from "@/domain/item/storeRarities";
import { POT_ITEM_NAMES, SPECIAL_SLOT_ITEM_NAMES } from "@/domain/player/Bag";
import type { ItemRepository } from "@/usecase/item/ItemRepository";

export interface StoreItemOutput {
  id: string;
  name: string;
  description: string;
  price: number;
  slot: EquipmentSlot | null;
  rarity: ItemRarity;
  rarityColor: string;
  hpRestore: number | null;
  /** Pots/Bandage/Antidote render in the store's separate consumables
   * section, priced the same as everything else (plan3 Store follow-up). */
  category: "consumable" | "gear";
}

/**
 * GET /store — the store's catalog. Pots, Bandage, Antidote, and every
 * basic gear/weapon item are purchasable this way instead of ever dropping
 * from a monster. `items.value` doubles as the store price — no separate
 * listings table. The store only sells basic/common/uncommon items; rare
 * and above never appear there.
 */
export class ListStoreItemsUseCase {
  constructor(private readonly itemRepository: ItemRepository) {}

  async execute(): Promise<StoreItemOutput[]> {
    const items = await this.itemRepository.findAll();
    return items
      .filter((item) => isStorePurchasable(item.rarity))
      .map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.value,
        slot: item.slot,
        rarity: item.rarity,
        rarityColor: ITEM_RARITY_COLORS[item.rarity],
        hpRestore: item.hpRestore,
        category: (SPECIAL_SLOT_ITEM_NAMES.includes(item.name) || POT_ITEM_NAMES.includes(item.name)
          ? "consumable"
          : "gear") as "consumable" | "gear",
      }));
  }
}
