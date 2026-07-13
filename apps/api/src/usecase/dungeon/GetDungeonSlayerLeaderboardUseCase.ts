import type { DungeonSlayerRankingRepository } from "@/usecase/dungeon/DungeonSlayerRankingRepository";
import type { PlayerRepository } from "@/usecase/player/PlayerRepository";

const LEADERBOARD_SIZE = 50;

export interface DungeonSlayerLeaderboardEntryOutput {
  playerName: string | null;
  kills: number;
  lastKillAt: string | null;
}

/**
 * GET /dungeon/leaderboard (plan3 §2g) — top 50 players by kills desc, ties
 * by last_kill_at asc. Public within the authenticated API — player_name is
 * already the intentionally-public on-screen identity.
 */
export class GetDungeonSlayerLeaderboardUseCase {
  constructor(
    private readonly dungeonSlayerRankingRepository: DungeonSlayerRankingRepository,
    private readonly playerRepository: PlayerRepository,
  ) {}

  async execute(): Promise<DungeonSlayerLeaderboardEntryOutput[]> {
    const rankings = await this.dungeonSlayerRankingRepository.findTop(LEADERBOARD_SIZE);

    const entries: DungeonSlayerLeaderboardEntryOutput[] = [];
    for (const ranking of rankings) {
      const player = await this.playerRepository.findById(ranking.playerId);
      entries.push({
        playerName: player?.playerName ?? null,
        kills: ranking.kills,
        lastKillAt: ranking.lastKillAt?.toISOString() ?? null,
      });
    }
    return entries;
  }
}
