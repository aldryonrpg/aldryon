import type { SQL } from "bun";
import type { EquipmentSlot, ItemRarity } from "@/domain/item/Item";
import { Item } from "@/domain/item/Item";
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
  });
}

export class PostgresItemRepository implements ItemRepository {
  constructor(private readonly sql: SQL) {}

  async findById(id: string): Promise<Item | null> {
    const rows = await this.sql<ItemRow[]>`select * from items where id = ${id} limit 1`;
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async findByName(name: string): Promise<Item | null> {
    const rows = await this.sql<ItemRow[]>`select * from items where name = ${name} limit 1`;
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async findByIds(ids: string[]): Promise<Item[]> {
    if (ids.length === 0) return [];
    const rows = await this.sql<ItemRow[]>`select * from items where id in ${this.sql(ids)}`;
    return rows.map(toDomain);
  }

  async findAll(): Promise<Item[]> {
    const rows = await this.sql<ItemRow[]>`select * from items order by name asc`;
    return rows.map(toDomain);
  }
}
