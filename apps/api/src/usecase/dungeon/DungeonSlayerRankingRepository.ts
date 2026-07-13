import type { DungeonSlayerRanking } from "@/domain/dungeon/DungeonSlayerRanking";

/** Port implemented by infrastructure (Postgres) for the Dungeon Slayer
 * leaderboard (plan3 §2g). */
export interface DungeonSlayerRankingRepository {
  /** Upserts +1 kill for the player, refreshing last_kill_at to `now`. */
  incrementKill(playerId: string, now: Date): Promise<void>;
  findByPlayerId(playerId: string): Promise<DungeonSlayerRanking | null>;
  /** Top `limit` players by kills desc, ties broken by last_kill_at asc. */
  findTop(limit: number): Promise<DungeonSlayerRanking[]>;
}
