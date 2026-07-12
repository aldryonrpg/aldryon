import type { SQL } from "bun";
import type { EquipmentPosition } from "@/domain/player/PlayerItem";
import { PlayerItem } from "@/domain/player/PlayerItem";
import type { PlayerItemRepository } from "@/usecase/player/PlayerItemRepository";

interface PlayerItemRow {
  id: string;
  player_id: string;
  item_id: string;
  equipped_slot: EquipmentPosition | null;
  quantity: number;
}

function toDomain(row: PlayerItemRow): PlayerItem {
  return PlayerItem.create({
    id: row.id,
    playerId: row.player_id,
    itemId: row.item_id,
    equippedSlot: row.equipped_slot,
    quantity: row.quantity,
  });
}

export class PostgresPlayerItemRepository implements PlayerItemRepository {
  constructor(private readonly sql: SQL) {}

  async findByPlayerId(playerId: string): Promise<PlayerItem[]> {
    const rows = await this.sql<
      PlayerItemRow[]
    >`select * from player_items where player_id = ${playerId} order by created_at asc`;
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<PlayerItem | null> {
    const rows = await this.sql<
      PlayerItemRow[]
    >`select * from player_items where id = ${id} limit 1`;
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async create(playerItem: PlayerItem): Promise<PlayerItem> {
    const props = playerItem.toProps();
    const rows = await this.sql<PlayerItemRow[]>`
      insert into player_items (id, player_id, item_id, equipped_slot, quantity, updated_at)
      values (${props.id}, ${props.playerId}, ${props.itemId}, ${props.equippedSlot}, ${props.quantity}, now())
      returning *
    `;
    const saved = rows[0];
    if (!saved) throw new Error("Failed to create player item: no row returned");
    return toDomain(saved);
  }

  async update(playerItem: PlayerItem): Promise<PlayerItem> {
    const props = playerItem.toProps();
    const rows = await this.sql<PlayerItemRow[]>`
      update player_items set
        equipped_slot = ${props.equippedSlot},
        quantity = ${props.quantity},
        updated_at = now()
      where id = ${props.id}
      returning *
    `;
    const saved = rows[0];
    if (!saved) throw new Error("Failed to update player item: no row returned");
    return toDomain(saved);
  }

  async delete(id: string): Promise<void> {
    await this.sql`delete from player_items where id = ${id}`;
  }
}
