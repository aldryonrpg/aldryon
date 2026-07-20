import { planUnequip } from "@/domain/player/Bag";
import { PlayerItem } from "@/domain/player/PlayerItem";
import type { PlayerItemRepository } from "@/usecase/player/PlayerItemRepository";

/**
 * Moves a currently-equipped instance back into the unequipped bag,
 * merging it into an existing same-item stack when there's room instead of
 * always leaving it as its own quantity-1 row — the counterpart to
 * EquipItemUseCase's split-off-one-unit step. Shared by UnequipItemUseCase
 * and EquipItemUseCase's own vacate-on-swap step so the merge rule lives in
 * exactly one place.
 *
 * `knownPlayerItems`, when passed, is used instead of an extra
 * findByPlayerId round trip — callers that already hold a (typically
 * row-locked, see withTransaction/findByPlayerIdForUpdate) snapshot of the
 * player's items pass it straight through.
 */
export async function returnItemToBag(
  playerItemRepository: PlayerItemRepository,
  playerId: string,
  equippedInstance: PlayerItem,
  knownPlayerItems?: PlayerItem[],
): Promise<PlayerItem> {
  const allPlayerItems = knownPlayerItems ?? (await playerItemRepository.findByPlayerId(playerId));
  const existingStack = allPlayerItems.find(
    (pi) =>
      !pi.isEquipped && pi.id !== equippedInstance.id && pi.itemId === equippedInstance.itemId,
  );

  const plan = planUnequip({
    existingStack: existingStack
      ? { playerItemId: existingStack.id, quantity: existingStack.quantity }
      : null,
  });

  if (plan.mergeIntoPlayerItemId && existingStack) {
    const merged = await playerItemRepository.update(
      PlayerItem.create({ ...existingStack.toProps(), quantity: existingStack.quantity + 1 }),
    );
    await playerItemRepository.delete(equippedInstance.id);
    return merged;
  }

  return playerItemRepository.update(
    PlayerItem.create({ ...equippedInstance.toProps(), equippedSlot: null }),
  );
}
