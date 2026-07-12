import { PlayerItem } from "@/domain/player/PlayerItem";
import { ItemNotEquippableError, PlayerItemNotFoundError } from "@/usecase/player/errors";
import type { PlayerItemRepository } from "@/usecase/player/PlayerItemRepository";

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
    const target = await this.playerItemRepository.findById(input.playerItemId);
    if (!target || target.playerId !== input.playerId) {
      throw new PlayerItemNotFoundError();
    }
    if (!target.isEquipped) {
      throw new ItemNotEquippableError("This item is not currently equipped");
    }

    const updated = await this.playerItemRepository.update(
      PlayerItem.create({ ...target.toProps(), equippedSlot: null }),
    );

    return { playerItem: updated };
  }
}
