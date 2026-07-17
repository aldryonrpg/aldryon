import type { BattleEffect } from "@/domain/battle/BattleEffect";
import { applyStatDebuffs } from "@/domain/battle/BattleEffect";
import { computeSetBonus } from "@/domain/player/equipmentSetBonus";
import type { Player } from "@/domain/player/Player";
import type { Attributes } from "@/domain/shared/Attributes";
import { sumAttributeBonuses } from "@/domain/shared/Attributes";
import type { ItemRepository } from "@/usecase/item/ItemRepository";
import type { PlayerItemRepository } from "@/usecase/player/PlayerItemRepository";

/**
 * A player's effective attributes = base + sum of equipped item bonuses +
 * a full-equipment-set completion bonus (plan2 §2, equipment-sets follow-
 * up), then any active Fear/Magic Aura Blast stat-decay debuff on top.
 * Joins player_items -> items to gather the currently equipped bonuses,
 * then delegates the >=1 floor to Player.effectiveAttributes. Returns both
 * `base` (before any debuff — item/set bonuses only) and `effective` (after)
 * so callers that need to show a debuff's before/after in the UI don't have
 * to redo the equipped-items lookup — see AttributesPanel's strikethrough.
 */
export async function computeEffectiveAttributesWithDebuff(
  player: Player,
  playerItemRepository: PlayerItemRepository,
  itemRepository: ItemRepository,
  setAttributeBonus: number,
  activeEffects: BattleEffect[] = [],
): Promise<{ base: Attributes; effective: Attributes }> {
  const playerItems = await playerItemRepository.findByPlayerId(player.id);
  const equipped = playerItems.filter((item) => item.isEquipped);

  let base: Attributes;
  if (equipped.length === 0) {
    base = player.effectiveAttributes({});
  } else {
    const equippedItems = await itemRepository.findByIds(equipped.map((item) => item.itemId));
    const itemBonuses = sumAttributeBonuses(equippedItems.map((item) => item.attributeBonuses));
    const setBonus = computeSetBonus(
      equippedItems
        .filter((item) => item.slot !== null)
        .map((item) => ({ slot: item.slot as string, setName: item.setName })),
      setAttributeBonus,
    );
    base = player.effectiveAttributes(sumAttributeBonuses([itemBonuses, setBonus]));
  }

  return { base, effective: applyStatDebuffs(base, activeEffects) };
}

export async function computeEffectiveAttributes(
  player: Player,
  playerItemRepository: PlayerItemRepository,
  itemRepository: ItemRepository,
  setAttributeBonus: number,
  activeEffects: BattleEffect[] = [],
): Promise<Attributes> {
  const { effective } = await computeEffectiveAttributesWithDebuff(
    player,
    playerItemRepository,
    itemRepository,
    setAttributeBonus,
    activeEffects,
  );
  return effective;
}
