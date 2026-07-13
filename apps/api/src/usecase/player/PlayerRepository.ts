import type { Player } from "@/domain/player/Player";

/** Port implemented by infrastructure (Postgres) for player persistence. */
export interface PlayerRepository {
  findByUserId(userId: string): Promise<Player | null>;
  findById(id: string): Promise<Player | null>;
  create(player: Player): Promise<Player>;
  update(player: Player): Promise<Player>;
}
