import { Battle } from "@/domain/battle/Battle";
import type { BattleEffect } from "@/domain/battle/BattleEffect";
import { BATTLE_CONFIG, maxStamina } from "@/domain/battle/battleConfig";
import { applyXpGain } from "@/domain/level/LevelCurve";
import { rollDropPool } from "@/domain/monster/dropRoll";
import type { Monster } from "@/domain/monster/Monster";
import { Player } from "@/domain/player/Player";
import type { Rng } from "@/domain/shared/Rng";
import type { BattleRepository } from "@/usecase/battle/BattleRepository";
import { settlePlayerDeath } from "@/usecase/battle/deathSettlement";
import type { AttackResultOutput, TurnReportOutput } from "@/usecase/battle/TurnReportOutput";
import type { LevelRepository } from "@/usecase/level/LevelRepository";
import type { PlayerRepository } from "@/usecase/player/PlayerRepository";

export interface SettleTurnParams {
  battle: Battle;
  player: Player;
  monster: Monster;
  playerCurrentHp: number;
  playerCurrentStamina: number;
  monsterCurrentHp: number;
  monsterCurrentStamina: number;
  playerEffects: BattleEffect[];
  monsterEffects: BattleEffect[];
  monsterChargingAttackId: string | null;
  chargeRoundsLeft: number;
  playerAttack: AttackResultOutput | null;
  monsterAttack: AttackResultOutput | null;
  messages: string[];
  playerMaxHp: number;
  rng: Rng;
  playerRepository: PlayerRepository;
  battleRepository: BattleRepository;
  levelRepository: LevelRepository;
  levelUpAttributePoints: number;
}

/**
 * Shared win/death/ongoing settlement + persistence + report building
 * (plan2 §5 steps 6-7), for turns where the player's own action never
 * damages the monster (Bag/Rest). DoT ticks can still kill either side.
 */
export async function settleTurn(params: SettleTurnParams): Promise<TurnReportOutput> {
  const {
    battle,
    player,
    monster,
    playerCurrentHp,
    playerCurrentStamina,
    monsterCurrentHp,
    monsterCurrentStamina,
    playerEffects,
    monsterEffects,
    monsterChargingAttackId,
    chargeRoundsLeft,
    playerAttack,
    monsterAttack,
    messages,
    playerMaxHp,
    rng,
    playerRepository,
    battleRepository,
    levelRepository,
    levelUpAttributePoints,
  } = params;

  if (monsterCurrentHp <= 0) {
    const levels = await levelRepository.findAll();
    const xpResult = applyXpGain({
      levels,
      currentXp: player.xp,
      currentLevel: player.level,
      xpGain: monster.xpGain,
      maxXp: BATTLE_CONFIG.maxXp,
      attributePointsPerLevel: levelUpAttributePoints,
    });

    const dropItemId = rollDropPool(monster.drops, rng);
    const exclusiveDropItemId = rollDropPool(monster.exclusiveDrops, rng);
    const lootOffer = [dropItemId, exclusiveDropItemId].filter((id): id is string => id !== null);

    const updatedPlayer = Player.create({
      ...player.toProps(),
      xp: xpResult.xp,
      level: xpResult.level,
      attributePoints: player.attributePoints + xpResult.attributePointsGained,
      pendingLoot: lootOffer,
    });
    await playerRepository.update(updatedPlayer);
    await battleRepository.deleteByPlayerId(player.id);

    return {
      playerAttack,
      monsterAttack,
      messages,
      playerStatus: {
        currentHp: playerCurrentHp,
        maxHp: playerMaxHp,
        currentStamina: playerCurrentStamina,
        maxStamina: maxStamina(player.level),
      },
      monsterStatus: {
        currentHp: 0,
        maxHp: monster.hp,
        currentStamina: monsterCurrentStamina,
        maxStamina: maxStamina(monster.level),
      },
      outcome: "won",
      lootOffer,
    };
  }

  if (playerCurrentHp <= 0) {
    await settlePlayerDeath(player, levelRepository, playerRepository);
    await battleRepository.deleteByPlayerId(player.id);

    return {
      playerAttack,
      monsterAttack,
      messages,
      playerStatus: {
        currentHp: 0,
        maxHp: playerMaxHp,
        currentStamina: playerCurrentStamina,
        maxStamina: maxStamina(player.level),
      },
      monsterStatus: {
        currentHp: monsterCurrentHp,
        maxHp: monster.hp,
        currentStamina: monsterCurrentStamina,
        maxStamina: maxStamina(monster.level),
      },
      outcome: "lost",
      lootOffer: null,
    };
  }

  const updatedBattle = Battle.create({
    ...battle.toProps(),
    playerCurrentHp,
    playerCurrentStamina,
    monsterCurrentHp,
    monsterCurrentStamina,
    round: battle.round + 1,
    playerEffects,
    monsterEffects,
    monsterChargingAttackId,
    chargeRoundsLeft,
  });
  await battleRepository.update(updatedBattle);

  return {
    playerAttack,
    monsterAttack,
    messages,
    playerStatus: {
      currentHp: playerCurrentHp,
      maxHp: playerMaxHp,
      currentStamina: playerCurrentStamina,
      maxStamina: maxStamina(player.level),
    },
    monsterStatus: {
      currentHp: monsterCurrentHp,
      maxHp: monster.hp,
      currentStamina: monsterCurrentStamina,
      maxStamina: maxStamina(monster.level),
    },
    outcome: "ongoing",
    lootOffer: null,
  };
}
