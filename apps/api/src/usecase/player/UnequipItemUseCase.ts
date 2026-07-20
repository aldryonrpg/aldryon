import type { PlayerItem } from "@/domain/player/PlayerItem";
import { ItemNotEquippableError, PlayerItemNotFoundError } from "@/usecase/player/errors";
import type { PlayerItemRepository } from "@/usecase/player/PlayerItemRepository";
import { returnItemToBag } from "@/usecase/player/returnItemToBag";

export interface UnequipItemInput {
  playerId: string;
  playerItemId: string;
}

export interface UnequipItemOutput {
  playerItem: PlayerItem;
}

export class UnequipItemUseCase {
  constructor(private readonly playerItemRepository: PlayerItemRepository) {}

  async execute(input: UnequipItemInput): Promise<UnequipItemOutput> {
    return this.playerItemRepository.withTransaction(async (txRepo) => {
      const allPlayerItems = await txRepo.findByPlayerIdForUpdate(input.playerId);
      const target = allPlayerItems.find((pi) => pi.id === input.playerItemId);
      if (!target) {
        throw new PlayerItemNotFoundError();
      }
      if (!target.isEquipped) {
        throw new ItemNotEquippableError("This item is not currently equipped");
      }

      const playerItem = await returnItemToBag(txRepo, input.playerId, target, allPlayerItems);

      return { playerItem };
    });
  }
}
