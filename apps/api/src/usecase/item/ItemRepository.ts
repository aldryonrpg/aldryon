import type { Item } from "@/domain/item/Item";

/** Port implemented by infrastructure (Postgres) for item catalog reads. */
export interface ItemRepository {
  findById(id: string): Promise<Item | null>;
  findByName(name: string): Promise<Item | null>;
  findByIds(ids: string[]): Promise<Item[]>;
}
