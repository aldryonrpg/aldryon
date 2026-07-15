import type { Attack } from "@/domain/attack/Attack";
import type { Battle } from "@/domain/battle/Battle";
import { consumeStunTurn, tickEffects } from "@/domain/battle/BattleEffect";
import { BATTLE_CONFIG, maxStamina } from "@/domain/battle/battleConfig";
import type { Monster } from "@/domain/monster/Monster";
import type { MonsterAttack } from "@/domain/monster/MonsterAttack";
import type { Player } from "@/domain/player/Player";
import type { Attributes } from "@/domain/shared/Attributes";
import type { Rng } from "@/domain/shared/Rng";
import type { BattleRepository } from "@/usecase/battle/BattleRepository";
import type { EffectCounterRepository } from "@/usecase/battle/EffectCounterRepository";
import { resolveMonsterTurn } from "@/usecase/battle/resolveMonsterTurn";
import { settleTurn } from "@/usecase/battle/settleTurn";
import type { TurnReportOutput } from "@/usecase/battle/TurnReportOutput";
import type { DungeonSlayerRankingRepository } from "@/usecase/dungeon/DungeonSlayerRankingRepository";
import type { ItemRepository } from "@/usecase/item/ItemRepository";
import type { UniqueItemOwnershipRepository } from "@/usecase/item/UniqueItemOwnershipRepository";
import type { LevelRepository } from "@/usecase/level/LevelRepository";
import type { PlayerRepository } from "@/usecase/player/PlayerRepository";

/**
 * Resolves a turn where the player is stunned: whatever action they
 * requested (attack/bag/rest/run) is voided — only the passive +5 Stamina
 * regen happens for them — while the monster still acts normally. Consumes
 * exactly one of the player's stunned turns (plan2 §6a extension: Stun).
 * Shared by all four battle use cases so stun handling lives in one place.
 */
export async function resolveStunnedTurn(params: {
  battle: Battle;
  player: Player;
  monster: Monster;
  moveset: MonsterAttack[];
  playerAttacks: Attack[];
  effectiveAttributes: Attributes;
  playerMaxHp: number;
  rng: Rng;
  effectCounterRepository: EffectCounterRepository;
  playerRepository: PlayerRepository;
  battleRepository: BattleRepository;
  levelRepository: LevelRepository;
  levelUpAttributePoints: number;
  stunCooldownRounds: number;
  dungeonSlayerRankingRepository: DungeonSlayerRankingRepository;
  itemRepository: ItemRepository;
  uniqueItemOwnershipRepository: UniqueItemOwnershipRepository;
}): Promise<TurnReportOutput> {
  const { battle, player, monster, moveset, playerAttacks, effectiveAttributes } = params;

  const playerCurrentStamina = Math.min(
    maxStamina(player.level),
    battle.playerCurrentStamina + BATTLE_CONFIG.passiveStaminaRegen,
  );

  const monsterTurn = await resolveMonsterTurn({
    state: {
      playerCurrentHp: battle.playerCurrentHp,
      monsterCurrentStamina: battle.monsterCurrentStamina,
      playerEffects: battle.playerEffects,
      monsterChargingAttackId: battle.monsterChargingAttackId,
      chargeRoundsLeft: battle.chargeRoundsLeft,
      monsterAttackWeights: battle.monsterAttackWeights,
      stunCooldownRoundsLeft: battle.stunCooldownRoundsLeft,
    },
    monster,
    moveset,
    playerAttacks,
    playerLevel: player.level,
    effectiveAttributes,
    rng: params.rng,
    effectCounterRepository: params.effectCounterRepository,
    stunCooldownRounds: params.stunCooldownRounds,
  });

  const playerEffectsAfterStun = consumeStunTurn(monsterTurn.playerEffects);
  const playerTick = tickEffects(playerEffectsAfterStun);
  const monsterTick = tickEffects(battle.monsterEffects);
  const playerCurrentHp = Math.max(0, monsterTurn.playerCurrentHp - playerTick.totalDamage);
  const monsterCurrentHp = Math.max(0, battle.monsterCurrentHp - monsterTick.totalDamage);

  return settleTurn({
    battle,
    player,
    monster,
    playerCurrentHp,
    playerCurrentStamina,
    monsterCurrentHp,
    monsterCurrentStamina: monsterTurn.monsterCurrentStamina,
    playerEffects: playerTick.remaining,
    monsterEffects: monsterTick.remaining,
    monsterChargingAttackId: monsterTurn.monsterChargingAttackId,
    chargeRoundsLeft: monsterTurn.chargeRoundsLeft,
    monsterAttackWeights: monsterTurn.monsterAttackWeights,
    stunCooldownRoundsLeft: monsterTurn.stunCooldownRoundsLeft,
    playerAttack: null,
    monsterAttack: monsterTurn.monsterAttack,
    messages: ["You are stunned and cannot act!", ...monsterTurn.messages],
    playerMaxHp: params.playerMaxHp,
    rng: params.rng,
    playerRepository: params.playerRepository,
    battleRepository: params.battleRepository,
    levelRepository: params.levelRepository,
    levelUpAttributePoints: params.levelUpAttributePoints,
    dungeonSlayerRankingRepository: params.dungeonSlayerRankingRepository,
    itemRepository: params.itemRepository,
    uniqueItemOwnershipRepository: params.uniqueItemOwnershipRepository,
  });
}
