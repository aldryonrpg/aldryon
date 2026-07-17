import type { ItemRarity } from "@/domain/item/Item";
import { ITEM_RARITY_COLORS } from "@/domain/item/itemRarityColors";

/**
 * GET /items/rarity-colors — the rarity->color mapping, fetched once by the
 * client after login and cached there rather than embedding a color string
 * on every single item response (equipment-sets/naming follow-up).
 */
export class GetItemRarityColorsUseCase {
  execute(): Record<ItemRarity, string> {
    return { ...ITEM_RARITY_COLORS };
  }
}
