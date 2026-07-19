import type { Player } from "@/domain/player/Player";

/** Port implemented by infrastructure (Postgres) for player persistence. */
export interface PlayerRepository {
  findByUserId(userId: string): Promise<Player | null>;
  findById(id: string): Promise<Player | null>;
  /** Case-insensitive lookup, used to pre-check name uniqueness. */
  findByName(name: string): Promise<Player | null>;
  /** Every player_name currently in use — boot-time seed for PlayerNameCache. */
  listPlayerNames(): Promise<string[]>;
  create(player: Player): Promise<Player>;
  update(player: Player): Promise<Player>;
}
