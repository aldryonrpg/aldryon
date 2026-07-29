import type { Item } from "@/domain/item/Item";

/** Port implemented by infrastructure (Postgres) for item catalog reads —
 * plus, since the admin item screen needs it, the two write paths. */
export interface ItemRepository {
  findById(id: string): Promise<Item | null>;
  findByName(name: string): Promise<Item | null>;
  findByIds(ids: string[]): Promise<Item[]>;
  /** The full item catalog — backs GET /items, so the client can resolve
   * display names for bare item ids (bag contents, loot offers). */
  findAll(): Promise<Item[]>;
  /** Admin create (plan9 follow-up). */
  create(item: Item): Promise<Item>;
  /** Admin patch (plan9 follow-up). */
  update(item: Item): Promise<Item>;
}
