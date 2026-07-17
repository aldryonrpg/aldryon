import { TtlCache } from "@/domain/shared/TtlCache";
import type { DungeonSlayerRankingRepository } from "@/usecase/dungeon/DungeonSlayerRankingRepository";
import type { PlayerRepository } from "@/usecase/player/PlayerRepository";

const LEADERBOARD_SIZE = 50;
const LEADERBOARD_CACHE_TTL_MS = 5 * 60 * 1000;

export interface DungeonSlayerLeaderboardEntryOutput {
  playerName: string | null;
  kills: number;
  lastKillAt: string | null;
}

/**
 * GET /dungeon/leaderboard (plan3 §2g) — top 50 players by kills desc, ties
 * by last_kill_at asc. Public within the authenticated API — player_name is
 * already the intentionally-public on-screen identity.
 *
 * Rendered on every logged-in user's Main Page, so it's a hot, no-input
 * read cached in-process for 5 minutes rather than re-querying rankings +
 * N player lookups on every page load.
 */
export class GetDungeonSlayerLeaderboardUseCase {
  private readonly cache = new TtlCache<DungeonSlayerLeaderboardEntryOutput[]>(
    LEADERBOARD_CACHE_TTL_MS,
  );

  constructor(
    private readonly dungeonSlayerRankingRepository: DungeonSlayerRankingRepository,
    private readonly playerRepository: PlayerRepository,
  ) {}

  async execute(): Promise<DungeonSlayerLeaderboardEntryOutput[]> {
    const cached = this.cache.get();
    if (cached) return cached;

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

    this.cache.set(entries);
    return entries;
  }
}
