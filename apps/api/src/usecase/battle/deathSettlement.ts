import { BATTLE_CONFIG } from "@/domain/battle/battleConfig";
import { applyDeathPenalty } from "@/domain/level/LevelCurve";
import { Player } from "@/domain/player/Player";
import type { LevelRepository } from "@/usecase/level/LevelRepository";
import type { PlayerRepository } from "@/usecase/player/PlayerRepository";

/**
 * Dying costs 1% of total XP (can de-level), stamps last_death_at in UTC,
 * no cooldown (plan2 §5/§6b/§10). Shared by AttackUseCase's death flow, the
 * fatal parting hit in RunFromBattleUseCase, and an ambush that kills the
 * player before a battle row is even created.
 */
export async function settlePlayerDeath(
  player: Player,
  levelRepository: LevelRepository,
  playerRepository: PlayerRepository,
): Promise<Player> {
  const levels = await levelRepository.findAll();
  const { xp, level } = applyDeathPenalty({
    levels,
    currentXp: player.xp,
    deathXpPenaltyRate: BATTLE_CONFIG.deathXpPenaltyRate,
  });

  const updated = Player.create({
    ...player.toProps(),
    xp,
    level,
    lastDeathAt: new Date(),
  });

  return playerRepository.update(updated);
}
