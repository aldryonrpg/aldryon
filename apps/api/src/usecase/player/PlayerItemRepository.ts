import type { PlayerItem } from "@/domain/player/PlayerItem";

/** Port implemented by infrastructure (Postgres) for bag/equipment persistence. */
export interface PlayerItemRepository {
  findByPlayerId(playerId: string): Promise<PlayerItem[]>;
  findById(id: string): Promise<PlayerItem | null>;
  create(playerItem: PlayerItem): Promise<PlayerItem>;
  update(playerItem: PlayerItem): Promise<PlayerItem>;
  delete(id: string): Promise<void>;
}
