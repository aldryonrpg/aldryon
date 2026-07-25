import type { SQL } from "bun";
import type { EquipmentSlot, ItemRarity } from "@/domain/item/Item";
import { Item } from "@/domain/item/Item";
import { KeyedTtlCache } from "@/domain/shared/TtlCache";
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
 * written to at runtime *in production*. findById()/findByIds() (equipped-
 * item lookups) are re-read on every single battle turn across every battle
 * usecase via computeEffectiveAttributesWithDebuff — cached **per id**
 * (`KeyedTtlCache`, same shape as `MonsterCatalogCache`), not as one
 * whole-table snapshot.
 *
 * A whole-table `TtlCache<Item[]>` was tried first (perf follow-up,
 * 2026-07-24) and reverted the same day: integration tests create items
 * dynamically via raw-SQL fixtures mid-test (`createTestItem`), so a
 * whole-table snapshot taken on the first `findById` call would silently
 * exclude every item created afterward for the rest of that snapshot's TTL
 * — `equipmentSetBonus.integration.test.ts`'s loop (seed item → equip →
 * seed next item → equip) hit this immediately, since the snapshot from
 * equipping the *first* piece never saw the *second* piece's row. Per-id
 * caching doesn't have this failure mode: each id is only ever cached once
 * it's actually been fetched, so a freshly-inserted row is always a cache
 * miss (and thus a real read) the first time anything asks for it. Don't
 * go back to whole-table caching here without solving that.
 */
export class PostgresItemRepository implements ItemRepository {
  private readonly cache = new KeyedTtlCache<string, Item>(CACHE_TTL_MS);

  constructor(private readonly sql: SQL) {}

  async findById(id: string): Promise<Item | null> {
    const cached = this.cache.get(id);
    if (cached) return cached;

    const rows = await this.sql<ItemRow[]>`select * from items where id = ${id} limit 1`;
    const item = rows[0] ? toDomain(rows[0]) : null;
    if (item) this.cache.set(id, item);
    return item;
  }

  async findByName(name: string): Promise<Item | null> {
    const rows = await this.sql<ItemRow[]>`select * from items where name = ${name} limit 1`;
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async findByIds(ids: string[]): Promise<Item[]> {
    if (ids.length === 0) return [];

    const found = new Map<string, Item>();
    const missingIds: string[] = [];
    for (const id of ids) {
      const cached = this.cache.get(id);
      if (cached) found.set(id, cached);
      else missingIds.push(id);
    }

    if (missingIds.length > 0) {
      const rows = await this.sql<
        ItemRow[]
      >`select * from items where id in ${this.sql(missingIds)}`;
      for (const row of rows) {
        const item = toDomain(row);
        this.cache.set(item.id, item);
        found.set(item.id, item);
      }
    }

    return ids.map((id) => found.get(id)).filter((item): item is Item => item !== undefined);
  }

  async findAll(): Promise<Item[]> {
    const rows = await this.sql<ItemRow[]>`select * from items order by name asc`;
    return rows.map(toDomain);
  }
}
