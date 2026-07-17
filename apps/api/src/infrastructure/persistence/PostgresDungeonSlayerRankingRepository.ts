import type { SQL } from "bun";
import { DungeonSlayerRanking } from "@/domain/dungeon/DungeonSlayerRanking";
import type { DungeonSlayerRankingRepository } from "@/usecase/dungeon/DungeonSlayerRankingRepository";

interface DungeonSlayerRankingRow {
  player_id: string;
  kills: number;
  last_kill_at: string | Date | null;
}

function toDate(value: string | Date | null): Date | null {
  if (value === null) return null;
  return value instanceof Date ? value : new Date(value);
}

function toDomain(row: DungeonSlayerRankingRow): DungeonSlayerRanking {
  return DungeonSlayerRanking.create({
    playerId: row.player_id,
    kills: row.kills,
    lastKillAt: toDate(row.last_kill_at),
  });
}

export class PostgresDungeonSlayerRankingRepository implements DungeonSlayerRankingRepository {
  constructor(private readonly sql: SQL) {}

  async incrementKill(playerId: string, now: Date): Promise<void> {
    await this.sql`
      insert into dungeon_slayer_rankings (player_id, kills, last_kill_at)
      values (${playerId}, 1, ${now})
      on conflict (player_id) do update set
        kills = dungeon_slayer_rankings.kills + 1,
        last_kill_at = ${now}
    `;
  }

  async findByPlayerId(playerId: string): Promise<DungeonSlayerRanking | null> {
    const rows = await this.sql<DungeonSlayerRankingRow[]>`
      select * from dungeon_slayer_rankings where player_id = ${playerId} limit 1
    `;
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async findTop(limit: number): Promise<DungeonSlayerRanking[]> {
    const rows = await this.sql<DungeonSlayerRankingRow[]>`
      select * from dungeon_slayer_rankings
      order by kills desc, last_kill_at asc
      limit ${limit}
    `;
    return rows.map(toDomain);
  }
}
