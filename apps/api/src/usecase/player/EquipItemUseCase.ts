import type { EquippedItemSnapshot } from "@/domain/player/Equipment";
import { resolveEquip } from "@/domain/player/Equipment";
import type { EquipmentPosition } from "@/domain/player/PlayerItem";
import { PlayerItem } from "@/domain/player/PlayerItem";
import type { ItemRepository } from "@/usecase/item/ItemRepository";
import { ItemNotEquippableError, PlayerItemNotFoundError } from "@/usecase/player/errors";
import type { PlayerItemRepository } from "@/usecase/player/PlayerItemRepository";

export interface EquipItemInput {
  playerId: string;
  playerItemId: string;
  preferredWeaponPosition?: "weapon_1" | "weapon_2";
}

export interface EquipItemOutput {
  playerItem: PlayerItem;
}

/**
 * The single place the equip slot/two-handed rules run (plan2 §3d/§7),
 * delegating the rule logic itself to domain/player/Equipment.
 */
export class EquipItemUseCase {
  constructor(
    private readonly playerItemRepository: PlayerItemRepository,
    private readonly itemRepository: ItemRepository,
  ) {}

  async execute(input: EquipItemInput): Promise<EquipItemOutput> {
    const target = await this.playerItemRepository.findById(input.playerItemId);
    if (!target || target.playerId !== input.playerId) {
      throw new PlayerItemNotFoundError();
    }

    const item = await this.itemRepository.findById(target.itemId);
    if (!item || item.slot === null) {
      throw new ItemNotEquippableError("This item cannot be equipped");
    }

    const allPlayerItems = await this.playerItemRepository.findByPlayerId(input.playerId);
    const equipped = allPlayerItems.filter((pi) => pi.isEquipped && pi.id !== target.id);
    const equippedItems = await this.itemRepository.findByIds(equipped.map((pi) => pi.itemId));
    const itemsById = new Map(equippedItems.map((i) => [i.id, i]));

    const snapshot: EquippedItemSnapshot[] = equipped.map((pi) => ({
      position: pi.equippedSlot as EquipmentPosition,
      isTwoHanded: itemsById.get(pi.itemId)?.slot === "two_handed_weapon",
    }));

    const result = resolveEquip(snapshot, item.slot, input.preferredWeaponPosition);
    if (!result.ok) {
      throw new ItemNotEquippableError(result.reason);
    }

    for (const position of result.positionsToVacate) {
      const occupant = equipped.find((pi) => pi.equippedSlot === position);
      if (occupant) {
        await this.playerItemRepository.update(
          PlayerItem.create({ ...occupant.toProps(), equippedSlot: null }),
        );
      }
    }

    const updated = await this.playerItemRepository.update(
      PlayerItem.create({ ...target.toProps(), equippedSlot: result.targetPosition }),
    );

    return { playerItem: updated };
  }
}
