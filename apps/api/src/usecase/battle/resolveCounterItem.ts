import type { BattleEffectKind } from "@/domain/monster/MonsterAttack";
import type { ItemRepository } from "@/usecase/item/ItemRepository";

const CANONICAL_CURE_ITEM_NAME: Partial<Record<BattleEffectKind, string>> = {
  bleed: "bandage",
  poison: "antidote",
};

/**
 * Resolves the canonical cure item id for a DoT kind (plan2 §6a) by the
 * catalog name convention. `burn` has no cure — monsters carry no bag.
 */
export async function resolveCounterItemId(
  kind: BattleEffectKind,
  itemRepository: ItemRepository,
): Promise<string | null> {
  const name = CANONICAL_CURE_ITEM_NAME[kind];
  if (!name) return null;
  const item = await itemRepository.findByName(name);
  return item?.id ?? null;
}
