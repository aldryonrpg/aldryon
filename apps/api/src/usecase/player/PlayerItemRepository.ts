import type { PlayerItem } from "@/domain/player/PlayerItem";

/** Port implemented by infrastructure (Postgres) for bag/equipment persistence. */
export interface PlayerItemRepository {
  findByPlayerId(playerId: string): Promise<PlayerItem[]>;
  findById(id: string): Promise<PlayerItem | null>;
  create(playerItem: PlayerItem): Promise<PlayerItem>;
  update(playerItem: PlayerItem): Promise<PlayerItem>;
  delete(id: string): Promise<void>;
  /** Same rows as findByPlayerId, but row-locked (`SELECT ... FOR UPDATE`).
   * Only meaningful inside a withTransaction callback: a second concurrent
   * transaction calling this for the same player blocks until the first
   * commits or rolls back, serializing equip/unequip against itself instead
   * of racing on a read-then-write. */
  findByPlayerIdForUpdate(playerId: string): Promise<PlayerItem[]>;
  /** Runs `fn` with a repository bound to a single Postgres transaction —
   * every call `fn` makes through the repository it's given commits
   * atomically together, or rolls back together if `fn` throws. */
  withTransaction<T>(fn: (repo: PlayerItemRepository) => Promise<T>): Promise<T>;
}
