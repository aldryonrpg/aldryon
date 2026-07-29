import type { Item } from "@/domain/item/Item";
import type { ItemRepository } from "@/usecase/item/ItemRepository";

/** GET /admin/items (plan9 follow-up) — the full item catalog, uncached at
 * this call site (PostgresItemRepository's own per-id cache still applies,
 * but findAll() always reads through to Postgres, same as
 * ListMonstersForAdminUseCase/ListDungeonBossesForAdminUseCase). */
export class ListItemsForAdminUseCase {
  constructor(private readonly itemRepository: ItemRepository) {}

  async execute(): Promise<Item[]> {
    return this.itemRepository.findAll();
  }
}
