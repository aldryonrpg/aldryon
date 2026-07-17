import { rollDropPool } from "@/domain/monster/dropRoll";
import type { DropTuple } from "@/domain/monster/Monster";
import type { Rng } from "@/domain/shared/Rng";
import type { ItemRepository } from "@/usecase/item/ItemRepository";
import type { UniqueItemOwnershipRepository } from "@/usecase/item/UniqueItemOwnershipRepository";

/**
 * Resolves the legendary_drops pool's winner, if any, additionally
 * enforcing global uniqueness for unique-rarity items (loot-system
 * follow-up): if the roll lands on a unique item that's already owned, the
 * roll is silently discarded (no item drops from this pool this kill)
 * rather than granting a duplicate. The ownership claim is a single atomic
 * DB operation, so this holds even if two players kill the boss at nearly
 * the same moment — only one can ever win the race.
 */
export async function resolveLegendaryDrop(
  pool: DropTuple[],
  playerId: string,
  rng: Rng,
  itemRepository: ItemRepository,
  uniqueItemOwnershipRepository: UniqueItemOwnershipRepository,
): Promise<string | null> {
  const winnerId = rollDropPool(pool, rng);
  if (!winnerId) return null;

  const item = await itemRepository.findById(winnerId);
  if (item?.rarity !== "unique") return winnerId;

  const claimed = await uniqueItemOwnershipRepository.tryClaim(winnerId, playerId, new Date());
  return claimed ? winnerId : null;
}
