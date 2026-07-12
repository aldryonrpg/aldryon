import type { Player } from "@/domain/player/Player";
import type { Attributes } from "@/domain/shared/Attributes";
import { sumAttributeBonuses } from "@/domain/shared/Attributes";
import type { ItemRepository } from "@/usecase/item/ItemRepository";
import type { PlayerItemRepository } from "@/usecase/player/PlayerItemRepository";

/**
 * A player's effective attributes = base + sum of equipped item bonuses
 * (plan2 §2). Joins player_items -> items to gather the currently equipped
 * bonuses, then delegates the >=1 floor to Player.effectiveAttributes.
 */
export async function computeEffectiveAttributes(
  player: Player,
  playerItemRepository: PlayerItemRepository,
  itemRepository: ItemRepository,
): Promise<Attributes> {
  const playerItems = await playerItemRepository.findByPlayerId(player.id);
  const equipped = playerItems.filter((item) => item.isEquipped);
  if (equipped.length === 0) {
    return player.effectiveAttributes({});
  }

  const items = await itemRepository.findByIds(equipped.map((item) => item.itemId));
  const bonuses = sumAttributeBonuses(items.map((item) => item.attributeBonuses));
  return player.effectiveAttributes(bonuses);
}
