import { Player } from "@/domain/player/Player";
import type { PlayerRepository } from "@/usecase/player/PlayerRepository";

export interface UpdatePlayerNameInput {
  playerId: string;
  playerName: string;
}

export interface UpdatePlayerNameOutput {
  playerName: string | null;
}

/** Patches player-owned profile data — for now just the on-screen player name (plan2 §3a). */
export class UpdatePlayerNameUseCase {
  constructor(private readonly playerRepository: PlayerRepository) {}

  async execute(input: UpdatePlayerNameInput): Promise<UpdatePlayerNameOutput> {
    const player = await this.playerRepository.findById(input.playerId);
    if (!player) throw new Error("Player not found");

    const updated = Player.create({ ...player.toProps(), playerName: input.playerName });
    const saved = await this.playerRepository.update(updated);

    return { playerName: saved.playerName };
  }
}
