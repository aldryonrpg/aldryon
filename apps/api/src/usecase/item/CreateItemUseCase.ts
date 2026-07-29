import type { EquipmentSlot, ItemRarity } from "@/domain/item/Item";
import { Item } from "@/domain/item/Item";
import type { AttributeValues } from "@/domain/shared/Attributes";
import { DuplicateItemNameError } from "@/usecase/item/errors";
import type { ItemRepository } from "@/usecase/item/ItemRepository";

export interface CreateItemInput {
  name: string;
  description: string;
  value: number;
  rarity: ItemRarity;
  slot: EquipmentSlot | null;
  attributeBonuses: AttributeValues;
  hpRestore: number | null;
  revealsAllMonsterAttributes: boolean;
  setName: string | null;
  storePurchasable: boolean;
  itemImage: string | null;
  isPermanent: boolean;
}

/**
 * POST /admin/items (plan9 follow-up). Same shape as CreateMonsterUseCase/
 * CreateDungeonBossUseCase: the DB's `name` unique constraint is the
 * backstop, `findByName` just turns that into a friendly domain error, and
 * `Item.create()` is the one place its invariants (value≥0, hpRestore>0
 * when set) live.
 */
export class CreateItemUseCase {
  constructor(private readonly itemRepository: ItemRepository) {}

  async execute(input: CreateItemInput): Promise<Item> {
    const existing = await this.itemRepository.findByName(input.name);
    if (existing) throw new DuplicateItemNameError(input.name);

    const item = Item.create({ id: Bun.randomUUIDv7(), ...input });
    return this.itemRepository.create(item);
  }
}
