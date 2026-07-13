import type { EquipmentSlot, ItemRarity } from "@/domain/item/Item";
import type { ItemRepository } from "@/usecase/item/ItemRepository";

export interface ItemCatalogEntryOutput {
  id: string;
  name: string;
  slot: EquipmentSlot | null;
  rarity: ItemRarity;
}

/**
 * GET /items — the full item catalog, so the client can resolve display
 * names for bare item ids (bag contents, loot offers) that aren't already
 * carried by a richer response.
 */
export class ListItemsUseCase {
  constructor(private readonly itemRepository: ItemRepository) {}

  async execute(): Promise<ItemCatalogEntryOutput[]> {
    const items = await this.itemRepository.findAll();
    return items.map((item) => ({
      id: item.id,
      name: item.name,
      slot: item.slot,
      rarity: item.rarity,
    }));
  }
}
