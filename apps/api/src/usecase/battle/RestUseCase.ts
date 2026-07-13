import { isStunned, tickEffects } from "@/domain/battle/BattleEffect";
import { BATTLE_CONFIG, maxHp, maxStamina } from "@/domain/battle/battleConfig";
import type { Rng } from "@/domain/shared/Rng";
import type { AttackRepository } from "@/usecase/attack/AttackRepository";
import type { BattleRepository } from "@/usecase/battle/BattleRepository";
import { NoActiveBattleError } from "@/usecase/battle/errors";
import { resolveMonsterTurn } from "@/usecase/battle/resolveMonsterTurn";
import { resolveStunnedTurn } from "@/usecase/battle/resolveStunnedTurn";
import { settleTurn } from "@/usecase/battle/settleTurn";
import type { TurnReportOutput } from "@/usecase/battle/TurnReportOutput";
import type { DungeonSlayerRankingRepository } from "@/usecase/dungeon/DungeonSlayerRankingRepository";
import type { ItemRepository } from "@/usecase/item/ItemRepository";
import type { LevelRepository } from "@/usecase/level/LevelRepository";
import type { MonsterAttackRepository } from "@/usecase/monster/MonsterAttackRepository";
import type { MonsterRepository } from "@/usecase/monster/MonsterRepository";
import { computeEffectiveAttributes } from "@/usecase/player/effectiveAttributes";
import type { PlayerItemRepository } from "@/usecase/player/PlayerItemRepository";
import type { PlayerRepository } from "@/usecase/player/PlayerRepository";

export interface RestInput {
  playerId: string;
}

/** Recover 15 Stamina (instead of the passive 5); resting still takes the turn (plan2 §5d). */
export class RestUseCase {
  constructor(
    private readonly playerRepository: PlayerRepository,
    private readonly playerItemRepository: PlayerItemRepository,
    private readonly itemRepository: ItemRepository,
    private readonly battleRepository: BattleRepository,
    private readonly monsterRepository: MonsterRepository,
    private readonly monsterAttackRepository: MonsterAttackRepository,
    private readonly attackRepository: AttackRepository,
    private readonly levelRepository: LevelRepository,
    private readonly rng: Rng,
    private readonly levelUpAttributePoints: number,
    private readonly stunCooldownRounds: number,
    private readonly dungeonSlayerRankingRepository: DungeonSlayerRankingRepository,
  ) {}

  async execute(input: RestInput): Promise<TurnReportOutput> {
    const battle = await this.battleRepository.findByPlayerId(input.playerId);
    if (!battle) throw new NoActiveBattleError();

    const player = await this.playerRepository.findById(input.playerId);
    if (!player) throw new Error("Player not found");

    const monster = await this.monsterRepository.findById(battle.monsterId);
    if (!monster) throw new Error("Monster not found");

    const [playerAttacks, moveset, effectiveAttributes] = await Promise.all([
      this.attackRepository.findAll(),
      this.monsterAttackRepository.findMovesetByMonsterId(monster.id),
      computeEffectiveAttributes(
        player,
        this.playerItemRepository,
        this.itemRepository,
        battle.playerEffects,
      ),
    ]);

    const playerMaxHp = maxHp(effectiveAttributes.vitality, effectiveAttributes.force);

    if (isStunned(battle.playerEffects)) {
      return resolveStunnedTurn({
        battle,
        player,
        monster,
        moveset,
        playerAttacks,
        effectiveAttributes,
        playerMaxHp,
        rng: this.rng,
        itemRepository: this.itemRepository,
        playerRepository: this.playerRepository,
        battleRepository: this.battleRepository,
        levelRepository: this.levelRepository,
        levelUpAttributePoints: this.levelUpAttributePoints,
        stunCooldownRounds: this.stunCooldownRounds,
        monsterRepository: this.monsterRepository,
        playerItemRepository: this.playerItemRepository,
        dungeonSlayerRankingRepository: this.dungeonSlayerRankingRepository,
      });
    }

    const playerCurrentStamina = Math.min(
      maxStamina(player.level),
      battle.playerCurrentStamina + BATTLE_CONFIG.restStaminaRegen,
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
      rng: this.rng,
      itemRepository: this.itemRepository,
      stunCooldownRounds: this.stunCooldownRounds,
    });

    const playerTick = tickEffects(monsterTurn.playerEffects);
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
      messages: monsterTurn.messages,
      playerMaxHp,
      rng: this.rng,
      playerRepository: this.playerRepository,
      battleRepository: this.battleRepository,
      levelRepository: this.levelRepository,
      levelUpAttributePoints: this.levelUpAttributePoints,
      monsterRepository: this.monsterRepository,
      playerItemRepository: this.playerItemRepository,
      itemRepository: this.itemRepository,
      dungeonSlayerRankingRepository: this.dungeonSlayerRankingRepository,
    });
  }
}
