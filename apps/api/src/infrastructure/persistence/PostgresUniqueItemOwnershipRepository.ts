import type { SQL } from "bun";
import type { OwnerHistoryEntry } from "@/domain/item/UniqueItemOwnership";
import { appendOwnerHistory, UniqueItemOwnership } from "@/domain/item/UniqueItemOwnership";
import { parseJsonbColumn } from "@/infrastructure/persistence/jsonbColumn";
import type { UniqueItemOwnershipRepository } from "@/usecase/item/UniqueItemOwnershipRepository";

interface UniqueItemOwnershipRow {
  item_id: string;
  current_owner_player_id: string | null;
  owner_history: unknown;
}

function toDomain(row: UniqueItemOwnershipRow): UniqueItemOwnership {
  return UniqueItemOwnership.create({
    itemId: row.item_id,
    currentOwnerPlayerId: row.current_owner_player_id,
    ownerHistory: parseJsonbColumn<OwnerHistoryEntry[]>(row.owner_history, []),
  });
}

export class PostgresUniqueItemOwnershipRepository implements UniqueItemOwnershipRepository {
  constructor(private readonly sql: SQL) {}

  async findByItemId(itemId: string): Promise<UniqueItemOwnership | null> {
    const rows = await this.sql<
      UniqueItemOwnershipRow[]
    >`select * from unique_item_ownership where item_id = ${itemId} limit 1`;
    return rows[0] ? toDomain(rows[0]) : null;
  }

  /** A single INSERT ... ON CONFLICT DO UPDATE ... WHERE — atomic
   * insert-or-conditionally-update. The WHERE clause on the DO UPDATE means
   * the update (and thus the RETURNING row) only happens when the item is
   * currently unowned; two concurrent claims can only ever have one winner. */
  async tryClaim(itemId: string, playerId: string, now: Date): Promise<boolean> {
    const rows = await this.sql<{ item_id: string }[]>`
      insert into unique_item_ownership (item_id, current_owner_player_id, owner_history, updated_at)
      values (${itemId}, ${playerId}, '[]'::jsonb, ${now})
      on conflict (item_id) do update
        set current_owner_player_id = ${playerId}, updated_at = ${now}
        where unique_item_ownership.current_owner_player_id is null
      returning item_id
    `;
    return rows.length > 0;
  }

  async release(itemId: string, playerId: string, now: Date): Promise<void> {
    const existing = await this.findByItemId(itemId);
    if (!existing || existing.currentOwnerPlayerId !== playerId) return;

    const newHistory = appendOwnerHistory(existing.ownerHistory, {
      playerId,
      timestampOfLastOwnership: now.toISOString(),
    });

    await this.sql`
      update unique_item_ownership set
        current_owner_player_id = null,
        owner_history = ${newHistory}::jsonb,
        updated_at = ${now}
      where item_id = ${itemId} and current_owner_player_id = ${playerId}
    `;
  }
}
