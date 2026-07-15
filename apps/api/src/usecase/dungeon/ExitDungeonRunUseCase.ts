import { Player } from "@/domain/player/Player";
import { NoDungeonRunInProgressError } from "@/usecase/dungeon/errors";
import type { PlayerRepository } from "@/usecase/player/PlayerRepository";

export interface ExitDungeonRunInput {
  playerId: string;
}

/**
 * POST /dungeon/exit (loot-system follow-up) — clears an abandoned dungeon
 * run (tier/step/totalSteps) so a fresh /dungeon/start isn't blocked. No
 * battle row exists at this point — the last kill already deleted it — so
 * there's nothing else to clean up.
 */
export class ExitDungeonRunUseCase {
  constructor(private readonly playerRepository: PlayerRepository) {}

  async execute(input: ExitDungeonRunInput): Promise<void> {
    const player = await this.playerRepository.findById(input.playerId);
    if (!player) throw new Error("Player not found");

    if (player.dungeonRunTier === null) {
      throw new NoDungeonRunInProgressError();
    }

    await this.playerRepository.update(
      Player.create({
        ...player.toProps(),
        dungeonRunTier: null,
        dungeonRunStep: null,
        dungeonRunTotalSteps: null,
      }),
    );
  }
}
