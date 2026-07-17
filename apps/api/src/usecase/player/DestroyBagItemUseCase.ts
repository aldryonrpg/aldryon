import type { ItemRepository } from "@/usecase/item/ItemRepository";
import type { UniqueItemOwnershipRepository } from "@/usecase/item/UniqueItemOwnershipRepository";
import { CannotDestroyEquippedItemError, PlayerItemNotFoundError } from "@/usecase/player/errors";
import type { PlayerItemRepository } from "@/usecase/player/PlayerItemRepository";

export interface DestroyBagItemInput {
  playerId: string;
  playerItemId: string;
}

/**
 * POST /player/bag/destroy (loot-system follow-up) — a free-standing bag-
 * management action on the loot screen, always available regardless of
 * whether any particular pick needs the room. Same ownership-check pattern
 * as EquipItemUseCase/UnequipItemUseCase. Destroying a unique-rarity item
 * releases its global ownership claim (recording it in the bounded owner
 * history) so it can be dropped again by someone else later.
 */
export class DestroyBagItemUseCase {
  constructor(
    private readonly playerItemRepository: PlayerItemRepository,
    private readonly itemRepository: ItemRepository,
    private readonly uniqueItemOwnershipRepository: UniqueItemOwnershipRepository,
  ) {}

  async execute(input: DestroyBagItemInput): Promise<void> {
    const target = await this.playerItemRepository.findById(input.playerItemId);
    if (!target || target.playerId !== input.playerId) {
      throw new PlayerItemNotFoundError();
    }
    if (target.isEquipped) {
      throw new CannotDestroyEquippedItemError();
    }

    const item = await this.itemRepository.findById(target.itemId);
    if (item?.rarity === "unique") {
      await this.uniqueItemOwnershipRepository.release(item.id, input.playerId, new Date());
    }

    await this.playerItemRepository.delete(target.id);
  }
}
