import {
  POT_ITEM_NAMES,
  planAddNormalItem,
  planAddPotItem,
  planAddSpecialItem,
  SPECIAL_SLOT_ITEM_NAMES,
} from "@/domain/player/Bag";
import { PlayerItem } from "@/domain/player/PlayerItem";
import type { ItemRepository } from "@/usecase/item/ItemRepository";
import type { PlayerItemRepository } from "@/usecase/player/PlayerItemRepository";

export interface PlaceItemInBagResult {
  fits: boolean;
  reason?: string;
}

async function upsertStack(
  playerItemRepository: PlayerItemRepository,
  playerId: string,
  itemId: string,
  existing: PlayerItem | undefined,
): Promise<void> {
  if (existing) {
    await playerItemRepository.update(
      PlayerItem.create({ ...existing.toProps(), quantity: existing.quantity + 1 }),
    );
  } else {
    await playerItemRepository.create(
      PlayerItem.create({
        id: Bun.randomUUIDv7(),
        playerId,
        itemId,
        equippedSlot: null,
        quantity: 1,
      }),
    );
  }
}

/**
 * Places one unit of `itemId` into the player's bag — special slot
 * (bandage/antidote, independently capped at 5 each), POT slot (small/
 * medium/big, sharing one combined `potLimit`), or the normal
 * capacity-limited bag, whichever the item's catalog name resolves to.
 * Shared by ClaimLootUseCase-adjacent flows and PurchaseItemUseCase so the
 * placement rules live in exactly one place.
 */
export async function placeItemInBag(
  playerId: string,
  itemId: string,
  isVip: boolean,
  potLimit: number,
  playerItemRepository: PlayerItemRepository,
  itemRepository: ItemRepository,
): Promise<PlaceItemInBagResult> {
  const item = await itemRepository.findById(itemId);
  if (!item) return { fits: false, reason: "Item no longer exists in the catalog" };

  const allPlayerItems = await playerItemRepository.findByPlayerId(playerId);
  const unequipped = allPlayerItems.filter((pi) => !pi.isEquipped);
  const unequippedItemIds = Array.from(new Set(unequipped.map((pi) => pi.itemId)));
  const catalogItems = await itemRepository.findByIds(unequippedItemIds);
  const nameById = new Map(catalogItems.map((catalogItem) => [catalogItem.id, catalogItem.name]));
  const isSpecial = (id: string) => SPECIAL_SLOT_ITEM_NAMES.includes(nameById.get(id) ?? "");
  const isPot = (id: string) => POT_ITEM_NAMES.includes(nameById.get(id) ?? "");

  if (SPECIAL_SLOT_ITEM_NAMES.includes(item.name)) {
    const existing = unequipped.find((pi) => pi.itemId === itemId);
    const plan = planAddSpecialItem(existing?.quantity ?? 0);
    if (!plan.fits) return { fits: false, reason: plan.reason };
    await upsertStack(playerItemRepository, playerId, itemId, existing);
    return { fits: true };
  }

  if (POT_ITEM_NAMES.includes(item.name)) {
    const potTotalQuantity = unequipped
      .filter((pi) => isPot(pi.itemId))
      .reduce((sum, pi) => sum + pi.quantity, 0);
    const plan = planAddPotItem(potTotalQuantity, potLimit);
    if (!plan.fits) return { fits: false, reason: plan.reason };
    const existing = unequipped.find((pi) => pi.itemId === itemId);
    await upsertStack(playerItemRepository, playerId, itemId, existing);
    return { fits: true };
  }

  const normalSlots = unequipped
    .filter((pi) => !isSpecial(pi.itemId) && !isPot(pi.itemId))
    .map((pi) => ({ playerItemId: pi.id, itemId: pi.itemId, quantity: pi.quantity }));
  const plan = planAddNormalItem({ slots: normalSlots, isVip }, itemId);
  if (!plan.fits) return { fits: false, reason: plan.reason };

  if (plan.targetPlayerItemId) {
    const existingEntity = unequipped.find((pi) => pi.id === plan.targetPlayerItemId);
    if (!existingEntity) throw new Error("Bag planning target not found");
    await playerItemRepository.update(
      PlayerItem.create({ ...existingEntity.toProps(), quantity: existingEntity.quantity + 1 }),
    );
  } else {
    await playerItemRepository.create(
      PlayerItem.create({
        id: Bun.randomUUIDv7(),
        playerId,
        itemId,
        equippedSlot: null,
        quantity: 1,
      }),
    );
  }
  return { fits: true };
}
