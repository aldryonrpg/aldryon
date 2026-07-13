import type { BattleEffect } from "@/domain/battle/BattleEffect";
import { applyStatDebuffs } from "@/domain/battle/BattleEffect";
import type { Player } from "@/domain/player/Player";
import type { Attributes } from "@/domain/shared/Attributes";
import { sumAttributeBonuses } from "@/domain/shared/Attributes";
import type { ItemRepository } from "@/usecase/item/ItemRepository";
import type { PlayerItemRepository } from "@/usecase/player/PlayerItemRepository";

/**
 * A player's effective attributes = base + sum of equipped item bonuses
 * (plan2 §2), then any active Fear/Magic Aura Blast stat-decay debuff on
 * top. Joins player_items -> items to gather the currently equipped
 * bonuses, then delegates the >=1 floor to Player.effectiveAttributes.
 */
export async function computeEffectiveAttributes(
  player: Player,
  playerItemRepository: PlayerItemRepository,
  itemRepository: ItemRepository,
  activeEffects: BattleEffect[] = [],
): Promise<Attributes> {
  const playerItems = await playerItemRepository.findByPlayerId(player.id);
  const equipped = playerItems.filter((item) => item.isEquipped);

  const base =
    equipped.length === 0
      ? player.effectiveAttributes({})
      : player.effectiveAttributes(
          sumAttributeBonuses(
            (await itemRepository.findByIds(equipped.map((item) => item.itemId))).map(
              (item) => item.attributeBonuses,
            ),
          ),
        );

  return applyStatDebuffs(base, activeEffects);
}
