import type { EquippedItemSnapshot } from "@/domain/player/Equipment";
import { resolveEquip } from "@/domain/player/Equipment";
import type { EquipmentPosition } from "@/domain/player/PlayerItem";
import { PlayerItem } from "@/domain/player/PlayerItem";
import type { ItemRepository } from "@/usecase/item/ItemRepository";
import { ItemNotEquippableError, PlayerItemNotFoundError } from "@/usecase/player/errors";
import type { PlayerItemRepository } from "@/usecase/player/PlayerItemRepository";
import { returnItemToBag } from "@/usecase/player/returnItemToBag";

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
    return this.playerItemRepository.withTransaction(async (txRepo) => {
      // A single row-locked read of every one of this player's items:
      // finds the target, builds the "what's currently equipped" snapshot,
      // AND is what a second concurrent equip/unequip call for the same
      // player blocks on until this transaction commits or rolls back —
      // closing the read-then-write race two overlapping requests used to
      // hit (see supabase-pooler-concurrent-request-issue memory).
      const allPlayerItems = await txRepo.findByPlayerIdForUpdate(input.playerId);
      const target = allPlayerItems.find((pi) => pi.id === input.playerItemId);
      if (!target) {
        throw new PlayerItemNotFoundError();
      }

      // Item catalog data (rarity/slot/attribute bonuses) is read-only,
      // effectively-static reference data — no realistic race with it, so
      // it's read via the plain (non-transactional) itemRepository rather
      // than needing a transactional variant of its own.
      const item = await this.itemRepository.findById(target.itemId);
      if (!item || item.slot === null) {
        throw new ItemNotEquippableError("This item cannot be equipped");
      }

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
          await returnItemToBag(txRepo, input.playerId, occupant, allPlayerItems);
        }
      }

      // A stack of 2+ identical items (gear stacks like anything else in
      // the bag, plan2 §3d) can't just flip equippedSlot on the whole row —
      // that would equip every unit in the stack at once, and a second unit
      // could never reach a *different* position (e.g. dual-wielding two of
      // the same one-handed weapon into weapon_1/weapon_2). Split one unit
      // off into its own quantity-1 row instead; returnItemToBag (used
      // above and by UnequipItemUseCase) merges it back on unequip.
      let equippedInstance: PlayerItem;
      if (!target.isEquipped && target.quantity > 1) {
        await txRepo.update(
          PlayerItem.create({ ...target.toProps(), quantity: target.quantity - 1 }),
        );
        equippedInstance = await txRepo.create(
          PlayerItem.create({
            id: Bun.randomUUIDv7(),
            playerId: input.playerId,
            itemId: target.itemId,
            equippedSlot: result.targetPosition,
            quantity: 1,
          }),
        );
      } else {
        equippedInstance = await txRepo.update(
          PlayerItem.create({ ...target.toProps(), equippedSlot: result.targetPosition }),
        );
      }

      return { playerItem: equippedInstance };
    });
  }
}
