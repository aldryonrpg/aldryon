import { BATTLE_CONFIG } from "@/domain/battle/battleConfig";
import { Player } from "@/domain/player/Player";
import type { PlayerRepository } from "@/usecase/player/PlayerRepository";

export interface GetOrCreatePlayerInput {
  userId: string;
}

export interface GetOrCreatePlayerOutput {
  player: Player;
}

/**
 * Players are created on first entry into the game, 1:1 with the existing
 * User (plan2 §3a). Invoked by authMiddleware on every authenticated
 * gameplay request.
 */
export class GetOrCreatePlayerUseCase {
  constructor(private readonly playerRepository: PlayerRepository) {}

  async execute(input: GetOrCreatePlayerInput): Promise<GetOrCreatePlayerOutput> {
    const existing = await this.playerRepository.findByUserId(input.userId);
    if (existing) return { player: existing };

    const player = Player.create({
      id: Bun.randomUUIDv7(),
      userId: input.userId,
      playerName: null,
      gold: 0,
      level: 1,
      xp: 0,
      attributePoints: BATTLE_CONFIG.startingAttributePoints,
      attributes: {
        strength: 10,
        dexterity: 10,
        agility: 10,
        intelligence: 10,
        vitality: 10,
        luck: 10,
      },
      lastDeathAt: null,
      lastRunAt: null,
      pendingLoot: [],
      dungeonAttempt1: null,
      dungeonAttempt2: null,
      dungeonRunTier: null,
      dungeonRunStep: null,
      dungeonRunTotalSteps: null,
      isVip: false,
    });

    const saved = await this.playerRepository.create(player);
    return { player: saved };
  }
}
