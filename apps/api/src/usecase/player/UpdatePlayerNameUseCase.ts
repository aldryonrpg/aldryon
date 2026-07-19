import { Player } from "@/domain/player/Player";
import { PlayerNameTakenError } from "@/usecase/player/errors";
import type { PlayerNameCache } from "@/usecase/player/PlayerNameCache";
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
  constructor(
    private readonly playerRepository: PlayerRepository,
    private readonly playerNameCache: PlayerNameCache,
  ) {}

  async execute(input: UpdatePlayerNameInput): Promise<UpdatePlayerNameOutput> {
    const player = await this.playerRepository.findById(input.playerId);
    if (!player) throw new Error("Player not found");

    // Bloom filter is a fast-path hint only, never authoritative — the DB
    // unique index (caught in PostgresPlayerRepository.update) is the real
    // uniqueness guarantee. "Definitely free" skips this lookup entirely.
    if (this.playerNameCache.mightBeTaken(input.playerName)) {
      const existing = await this.playerRepository.findByName(input.playerName);
      if (existing && existing.id !== player.id) throw new PlayerNameTakenError();
    }

    const updated = Player.create({ ...player.toProps(), playerName: input.playerName });
    const saved = await this.playerRepository.update(updated);
    this.playerNameCache.markTaken(input.playerName);

    return { playerName: saved.playerName };
  }
}
