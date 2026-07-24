import type { SQL } from "bun";
import type { EquipmentSlot, ItemRarity } from "@/domain/item/Item";
import { Item } from "@/domain/item/Item";
import { TtlCache } from "@/domain/shared/TtlCache";
import type { ItemRepository } from "@/usecase/item/ItemRepository";

interface ItemRow {
  id: string;
  name: string;
  description: string;
  value: number;
  rarity: ItemRarity;
  slot: EquipmentSlot | null;
  strength: number;
  dexterity: number;
  agility: number;
  intelligence: number;
  vitality: number;
  luck: number;
  hp_restore: number | null;
  reveals_all_monster_attributes: boolean;
  set_name: string | null;
  store_purchasable: boolean;
  item_image: string | null;
  is_permanent: boolean;
}

function toDomain(row: ItemRow): Item {
  return Item.create({
    id: row.id,
    name: row.name,
    description: row.description,
    value: row.value,
    rarity: row.rarity,
    slot: row.slot,
    attributeBonuses: {
      strength: row.strength,
      dexterity: row.dexterity,
      agility: row.agility,
      intelligence: row.intelligence,
      vitality: row.vitality,
      luck: row.luck,
    },
    hpRestore: row.hp_restore,
    revealsAllMonsterAttributes: row.reveals_all_monster_attributes,
    setName: row.set_name,
    storePurchasable: row.store_purchasable,
    itemImage: row.item_image,
    isPermanent: row.is_permanent,
  });
}

const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * `items` is catalog data (plan2 §3b) — new rows added by content-authoring
 * migrations, existing rows occasionally edited the same way, but never
 * written to at runtime. findByIds() (equipped-item lookups) is re-read on
 * every single battle turn across every battle usecase via
 * computeEffectiveAttributesWithDebuff, plus findAll()/findById() from the
 * Store and Bag — caching the whole table (same TTL convention as
 * MonsterCatalogCache) turns all of those into in-memory lookups after the
 * first read. Same accepted tradeoff as MonsterCatalogCache: a migration
 * that changes the catalog while the process is already up won't be visible
 * until the cache expires (up to an hour) or the process restarts.
 */
export class PostgresItemRepository implements ItemRepository {
  private readonly cache = new TtlCache<Item[]>(CACHE_TTL_MS);

  constructor(private readonly sql: SQL) {}

  private async getOrLoadAll(): Promise<Item[]> {
    const cached = this.cache.get();
    if (cached) return cached;

    const rows = await this.sql<ItemRow[]>`select * from items order by name asc`;
    const items = rows.map(toDomain);
    this.cache.set(items);
    return items;
  }

  async findById(id: string): Promise<Item | null> {
    const items = await this.getOrLoadAll();
    return items.find((item) => item.id === id) ?? null;
  }

  async findByName(name: string): Promise<Item | null> {
    const items = await this.getOrLoadAll();
    return items.find((item) => item.name === name) ?? null;
  }

  async findByIds(ids: string[]): Promise<Item[]> {
    if (ids.length === 0) return [];
    const idSet = new Set(ids);
    const items = await this.getOrLoadAll();
    return items.filter((item) => idSet.has(item.id));
  }

  async findAll(): Promise<Item[]> {
    return this.getOrLoadAll();
  }
}
