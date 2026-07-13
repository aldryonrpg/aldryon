import {
  planAddNormalItem,
  planAddSpecialItem,
  SPECIAL_SLOT_ITEM_NAMES,
} from "@/domain/player/Bag";
import { Player } from "@/domain/player/Player";
import { PlayerItem } from "@/domain/player/PlayerItem";
import { InvalidLootPickError, NoPendingLootError } from "@/usecase/battle/errors";
import type { ItemRepository } from "@/usecase/item/ItemRepository";
import type { PlayerItemRepository } from "@/usecase/player/PlayerItemRepository";
import type { PlayerRepository } from "@/usecase/player/PlayerRepository";

export interface ClaimLootInput {
  playerId: string;
  isVip: boolean;
  picks: string[];
}

export interface ClaimLootOutput {
  claimed: string[];
  rejected: { itemId: string; reason: string }[];
}

/**
 * Claims picks from the kill's numbered loot offer (plan2 §5e). A pick that
 * doesn't fit the bag is rejected with the reason; the rest still land.
 * Claimed picks are removed from pending_loot — the rest stay pending until
 * the next battle start forfeits them.
 */
export class ClaimLootUseCase {
  constructor(
    private readonly playerRepository: PlayerRepository,
    private readonly playerItemRepository: PlayerItemRepository,
    private readonly itemRepository: ItemRepository,
  ) {}

  async execute(input: ClaimLootInput): Promise<ClaimLootOutput> {
    const player = await this.playerRepository.findById(input.playerId);
    if (!player) throw new Error("Player not found");
    if (player.pendingLoot.length === 0) throw new NoPendingLootError();

    for (const pick of input.picks) {
      if (!player.pendingLoot.includes(pick)) throw new InvalidLootPickError(pick);
    }

    const allPlayerItems = await this.playerItemRepository.findByPlayerId(player.id);
    const unequipped = allPlayerItems.filter((pi) => !pi.isEquipped);

    const relevantItemIds = Array.from(
      new Set([...unequipped.map((pi) => pi.itemId), ...input.picks]),
    );
    const relevantItems = await this.itemRepository.findByIds(relevantItemIds);
    const itemsById = new Map(relevantItems.map((item) => [item.id, item]));
    const isSpecial = (itemId: string) => {
      const item = itemsById.get(itemId);
      return item ? SPECIAL_SLOT_ITEM_NAMES.includes(item.name) : false;
    };

    const normalSlots = unequipped
      .filter((pi) => !isSpecial(pi.itemId))
      .map((pi) => ({ playerItemId: pi.id, itemId: pi.itemId, quantity: pi.quantity }));
    const specialByItemId = new Map(
      unequipped.filter((pi) => isSpecial(pi.itemId)).map((pi) => [pi.itemId, pi]),
    );

    const claimed: string[] = [];
    const rejected: { itemId: string; reason: string }[] = [];

    for (const pick of input.picks) {
      const item = itemsById.get(pick);
      if (!item) {
        rejected.push({ itemId: pick, reason: "Item no longer exists in the catalog" });
        continue;
      }

      if (isSpecial(pick)) {
        const existing = specialByItemId.get(pick);
        const plan = planAddSpecialItem(existing?.quantity ?? 0);
        if (!plan.fits) {
          rejected.push({ itemId: pick, reason: plan.reason ?? "Special slot is full" });
          continue;
        }
        if (existing) {
          const updated = PlayerItem.create({
            ...existing.toProps(),
            quantity: existing.quantity + 1,
          });
          await this.playerItemRepository.update(updated);
          specialByItemId.set(pick, updated);
        } else {
          const created = PlayerItem.create({
            id: Bun.randomUUIDv7(),
            playerId: player.id,
            itemId: pick,
            equippedSlot: null,
            quantity: 1,
          });
          await this.playerItemRepository.create(created);
          specialByItemId.set(pick, created);
        }
        claimed.push(pick);
        continue;
      }

      const plan = planAddNormalItem({ slots: normalSlots, isVip: input.isVip }, pick);
      if (!plan.fits) {
        rejected.push({ itemId: pick, reason: plan.reason ?? "Bag is full" });
        continue;
      }

      if (plan.targetPlayerItemId) {
        const target = normalSlots.find((slot) => slot.playerItemId === plan.targetPlayerItemId);
        const existingEntity = unequipped.find((pi) => pi.id === plan.targetPlayerItemId);
        if (!target || !existingEntity) throw new Error("Bag planning target not found");
        const updated = PlayerItem.create({
          ...existingEntity.toProps(),
          quantity: existingEntity.quantity + 1,
        });
        await this.playerItemRepository.update(updated);
        target.quantity += 1;
      } else {
        const created = PlayerItem.create({
          id: Bun.randomUUIDv7(),
          playerId: player.id,
          itemId: pick,
          equippedSlot: null,
          quantity: 1,
        });
        await this.playerItemRepository.create(created);
        normalSlots.push({ playerItemId: created.id, itemId: pick, quantity: 1 });
      }
      claimed.push(pick);
    }

    const updatedPlayer = Player.create({
      ...player.toProps(),
      pendingLoot: player.pendingLoot.filter((id) => !claimed.includes(id)),
    });
    await this.playerRepository.update(updatedPlayer);

    return { claimed, rejected };
  }
}
