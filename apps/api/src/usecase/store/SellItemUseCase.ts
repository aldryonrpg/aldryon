import { Player } from "@/domain/player/Player";
import type { ItemRepository } from "@/usecase/item/ItemRepository";
import type { UniqueItemOwnershipRepository } from "@/usecase/item/UniqueItemOwnershipRepository";
import { PlayerItemNotFoundError } from "@/usecase/player/errors";
import type { PlayerItemRepository } from "@/usecase/player/PlayerItemRepository";
import type { PlayerRepository } from "@/usecase/player/PlayerRepository";
import { CannotSellEquippedItemError } from "@/usecase/store/errors";

export interface SellItemInput {
  playerId: string;
  playerItemId: string;
}

export interface SellItemOutput {
  gold: number;
}

/**
 * POST /store/sell — the Store-only counterpart to Purchase: sells an
 * entire bag stack back for `item.value * quantity` gold, the same value
 * used as the store's buy price. This is currently the only way a player
 * ever gains gold (kills only grant XP/loot, not gold directly), so any
 * item — not just `storePurchasable` ones — can be sold, including
 * drop-only set pieces and legendary/unique items. Selling a unique-rarity
 * item releases its global ownership claim (same as destroying one) so it
 * can be dropped again by someone else later.
 */
export class SellItemUseCase {
  constructor(
    private readonly playerRepository: PlayerRepository,
    private readonly playerItemRepository: PlayerItemRepository,
    private readonly itemRepository: ItemRepository,
    private readonly uniqueItemOwnershipRepository: UniqueItemOwnershipRepository,
  ) {}

  async execute(input: SellItemInput): Promise<SellItemOutput> {
    const target = await this.playerItemRepository.findById(input.playerItemId);
    if (!target || target.playerId !== input.playerId) {
      throw new PlayerItemNotFoundError();
    }
    if (target.isEquipped) {
      throw new CannotSellEquippedItemError();
    }

    const player = await this.playerRepository.findById(input.playerId);
    if (!player) throw new Error("Player not found");

    const item = await this.itemRepository.findById(target.itemId);
    if (!item) throw new PlayerItemNotFoundError();

    if (item.rarity === "unique") {
      await this.uniqueItemOwnershipRepository.release(item.id, input.playerId, new Date());
    }

    const saleGold = item.value * target.quantity;
    const updatedPlayer = Player.create({ ...player.toProps(), gold: player.gold + saleGold });
    await this.playerRepository.update(updatedPlayer);

    await this.playerItemRepository.delete(target.id);

    return { gold: updatedPlayer.gold };
  }
}
