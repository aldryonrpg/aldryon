import { potLimitForLevel } from "@/domain/player/Bag";
import { Player } from "@/domain/player/Player";
import type { ItemRepository } from "@/usecase/item/ItemRepository";
import type { PlayerItemRepository } from "@/usecase/player/PlayerItemRepository";
import type { PlayerRepository } from "@/usecase/player/PlayerRepository";
import { placeItemInBag } from "@/usecase/player/placeItemInBag";
import {
  BagFullError,
  InsufficientGoldError,
  ItemNotPurchasableError,
} from "@/usecase/store/errors";

export interface PurchaseItemInput {
  playerId: string;
  itemId: string;
}

export interface PurchaseItemOutput {
  gold: number;
  playerItem: {
    id: string;
    itemId: string;
    equippedSlot: string | null;
    quantity: number;
  };
}

/**
 * POST /store/purchase — buys exactly one unit of a store item for gold
 * (plan3 Store follow-up). Rejects anything not `storePurchasable` (a
 * per-item flag, not just rarity — equipment-sets follow-up), insufficient
 * gold, or a full bag/special-slot/POT-slot — same placement rules a loot
 * claim would hit, via the shared placeItemInBag helper.
 */
export class PurchaseItemUseCase {
  constructor(
    private readonly playerRepository: PlayerRepository,
    private readonly playerItemRepository: PlayerItemRepository,
    private readonly itemRepository: ItemRepository,
  ) {}

  async execute(input: PurchaseItemInput): Promise<PurchaseItemOutput> {
    const player = await this.playerRepository.findById(input.playerId);
    if (!player) throw new Error("Player not found");

    const item = await this.itemRepository.findById(input.itemId);
    if (!item?.storePurchasable) {
      throw new ItemNotPurchasableError();
    }
    if (player.gold < item.value) {
      throw new InsufficientGoldError(item.value, player.gold);
    }

    const placement = await placeItemInBag(
      player.id,
      item.id,
      player.isVip,
      potLimitForLevel(player.level),
      this.playerItemRepository,
      this.itemRepository,
    );
    if (!placement.fits) {
      throw new BagFullError(placement.reason ?? "Bag is full");
    }

    const updatedPlayer = Player.create({ ...player.toProps(), gold: player.gold - item.value });
    await this.playerRepository.update(updatedPlayer);

    const playerItems = await this.playerItemRepository.findByPlayerId(player.id);
    const playerItem = playerItems.find((pi) => pi.itemId === item.id);
    if (!playerItem) throw new Error("Purchased item not found after placement");

    return {
      gold: updatedPlayer.gold,
      playerItem: {
        id: playerItem.id,
        itemId: playerItem.itemId,
        equippedSlot: playerItem.equippedSlot,
        quantity: playerItem.quantity,
      },
    };
  }
}
