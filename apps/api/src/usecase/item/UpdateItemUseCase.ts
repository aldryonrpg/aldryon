import type { EquipmentSlot, ItemRarity } from "@/domain/item/Item";
import { Item } from "@/domain/item/Item";
import type { AttributeValues } from "@/domain/shared/Attributes";
import { DuplicateItemNameError, ItemNotFoundError } from "@/usecase/item/errors";
import type { ItemRepository } from "@/usecase/item/ItemRepository";

export interface UpdateItemInput {
  id: string;
  name?: string;
  description?: string;
  value?: number;
  rarity?: ItemRarity;
  slot?: EquipmentSlot | null;
  attributeBonuses?: AttributeValues;
  hpRestore?: number | null;
  revealsAllMonsterAttributes?: boolean;
  setName?: string | null;
  storePurchasable?: boolean;
  itemImage?: string | null;
  isPermanent?: boolean;
}

/**
 * PATCH /admin/items/:id (plan9 follow-up). Merges the provided fields onto
 * the existing row and re-validates through Item.create() — same reuse
 * rationale as UpdateMonsterUseCase/UpdateDungeonBossUseCase. Every
 * equipped-item read (computeEffectiveAttributesWithDebuff, on every battle
 * turn) goes through ItemRepository.findById, which PostgresItemRepository
 * caches per-id — `update()` refreshes that cache itself as part of the
 * write, so unlike Monster this usecase doesn't need to separately evict
 * anything.
 */
export class UpdateItemUseCase {
  constructor(private readonly itemRepository: ItemRepository) {}

  async execute(input: UpdateItemInput): Promise<Item> {
    const existing = await this.itemRepository.findById(input.id);
    if (!existing) throw new ItemNotFoundError();

    if (input.name && input.name !== existing.name) {
      const nameOwner = await this.itemRepository.findByName(input.name);
      if (nameOwner && nameOwner.id !== input.id) {
        throw new DuplicateItemNameError(input.name);
      }
    }

    const { id, ...patch } = input;
    const merged = Item.create({ ...existing.toProps(), ...patch });

    return this.itemRepository.update(merged);
  }
}
