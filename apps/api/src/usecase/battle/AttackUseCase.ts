import { addBattleEffect, isStunned, tickEffects } from "@/domain/battle/BattleEffect";
import { BATTLE_CONFIG, maxHp, maxStamina } from "@/domain/battle/battleConfig";
import { computeDamage } from "@/domain/battle/services/DamageCalculator";
import { rollEffectProc } from "@/domain/battle/services/EffectResolver";
import { rollHit } from "@/domain/battle/services/HitCheck";
import { pickUnrevealedAttribute } from "@/domain/monster/monsterAttributeReveal";
import type { Rng } from "@/domain/shared/Rng";
import type { AttackRepository } from "@/usecase/attack/AttackRepository";
import type { BattleRepository } from "@/usecase/battle/BattleRepository";
import type { EffectCounterRepository } from "@/usecase/battle/EffectCounterRepository";
import {
  AttackNotUsableError,
  NoActiveBattleError,
  UnknownAttackError,
} from "@/usecase/battle/errors";
import { resolveCounterItemId } from "@/usecase/battle/resolveCounterItem";
import { resolveMonsterTurn } from "@/usecase/battle/resolveMonsterTurn";
import { resolveStunnedTurn } from "@/usecase/battle/resolveStunnedTurn";
import { settleTurn } from "@/usecase/battle/settleTurn";
import type { TurnReportOutput } from "@/usecase/battle/TurnReportOutput";
import type { DungeonSlayerRankingRepository } from "@/usecase/dungeon/DungeonSlayerRankingRepository";
import type { ItemRepository } from "@/usecase/item/ItemRepository";
import type { UniqueItemOwnershipRepository } from "@/usecase/item/UniqueItemOwnershipRepository";
import type { LevelRepository } from "@/usecase/level/LevelRepository";
import type { MonsterCatalogCache } from "@/usecase/monster/MonsterCatalogCache";
import { computeEffectiveAttributesWithDebuff } from "@/usecase/player/effectiveAttributes";
import type { PlayerItemRepository } from "@/usecase/player/PlayerItemRepository";
import type { PlayerRepository } from "@/usecase/player/PlayerRepository";

export interface AttackInput {
  playerId: string;
  attackName: string;
}

/**
 * A full battle turn (plan2 §5a): player's strike, monster's reply (via the
 * shared `resolveMonsterTurn`, incl. the charge/unleash state machine),
 * effect ticks, and kill/death settlement (via the shared `settleTurn`). If
 * the player is stunned, the whole turn is delegated to
 * `resolveStunnedTurn` instead — no attack is validated or resolved.
 */
export class AttackUseCase {
  constructor(
    private readonly playerRepository: PlayerRepository,
    private readonly playerItemRepository: PlayerItemRepository,
    private readonly itemRepository: ItemRepository,
    private readonly battleRepository: BattleRepository,
    private readonly monsterCatalogCache: MonsterCatalogCache,
    private readonly attackRepository: AttackRepository,
    private readonly levelRepository: LevelRepository,
    private readonly rng: Rng,
    private readonly levelUpAttributePoints: number,
    private readonly statusCooldownRounds: number,
    private readonly dungeonSlayerRankingRepository: DungeonSlayerRankingRepository,
    private readonly effectCounterRepository: EffectCounterRepository,
    private readonly uniqueItemOwnershipRepository: UniqueItemOwnershipRepository,
    private readonly setAttributeBonus: number,
  ) {}

  async execute(input: AttackInput): Promise<TurnReportOutput> {
    const battle = await this.battleRepository.findByPlayerId(input.playerId);
    if (!battle) throw new NoActiveBattleError();

    const player = await this.playerRepository.findById(input.playerId);
    if (!player) throw new Error("Player not found");

    const [
      playerAttacks,
      monsterWithMoveset,
      { base: attributesBeforeDebuff, effective: effectiveAttributes },
    ] = await Promise.all([
      this.attackRepository.findAll(),
      this.monsterCatalogCache.getMonsterWithMoveset(battle.monsterId),
      computeEffectiveAttributesWithDebuff(
        player,
        this.playerItemRepository,
        this.itemRepository,
        this.setAttributeBonus,
        battle.playerEffects,
      ),
    ]);
    if (!monsterWithMoveset) throw new Error("Monster not found");
    const { monster, moveset } = monsterWithMoveset;

    const playerMaxHp = maxHp(effectiveAttributes.vitality, effectiveAttributes.strength);

    if (isStunned(battle.playerEffects)) {
      return resolveStunnedTurn({
        battle,
        player,
        monster,
        moveset,
        effectiveAttributes,
        attributesBeforeDebuff,
        playerMaxHp,
        rng: this.rng,
        effectCounterRepository: this.effectCounterRepository,
        playerRepository: this.playerRepository,
        battleRepository: this.battleRepository,
        levelRepository: this.levelRepository,
        levelUpAttributePoints: this.levelUpAttributePoints,
        statusCooldownRounds: this.statusCooldownRounds,
        dungeonSlayerRankingRepository: this.dungeonSlayerRankingRepository,
        itemRepository: this.itemRepository,
        uniqueItemOwnershipRepository: this.uniqueItemOwnershipRepository,
      });
    }

    const attack = playerAttacks.find((a) => a.name === input.attackName);
    if (!attack) throw new UnknownAttackError(input.attackName);
    if (battle.playerCurrentStamina < attack.staminaCost) {
      throw new AttackNotUsableError("Not enough stamina for this attack");
    }
    if (!attack.meetsRequirements(player.level, effectiveAttributes.toValues())) {
      throw new AttackNotUsableError("Attack requirements not met");
    }

    const monsterAttributes = monster.getAttributes();
    const messages: string[] = [];

    let monsterCurrentHp = battle.monsterCurrentHp;
    let playerCurrentStamina = battle.playerCurrentStamina - attack.staminaCost;
    let monsterCurrentStamina = battle.monsterCurrentStamina;
    let playerCurrentHp = battle.playerCurrentHp;
    let playerEffects = battle.playerEffects;
    let monsterEffects = battle.monsterEffects;
    let monsterChargingAttackId = battle.monsterChargingAttackId;
    let chargeRoundsLeft = battle.chargeRoundsLeft;
    let monsterAttackWeights = battle.monsterAttackWeights;
    let statusCooldownRoundsLeft = battle.statusCooldownRoundsLeft;
    let revealedMonsterAttributes = battle.revealedMonsterAttributes;

    // Step 1-3: resolve the player's strike (plan2 §6).
    const playerHit = rollHit(
      {
        attackerDexterity: effectiveAttributes.dexterity,
        defenderAgility: monsterAttributes.agility,
        attackerLuck: effectiveAttributes.luck,
      },
      this.rng,
    );

    let playerDamage = 0;
    let playerEffectApplied: string | null = null;

    if (playerHit) {
      playerDamage = computeDamage({
        attackMultiplier: attack.multiplier,
        attackerScalingValue: effectiveAttributes.get(attack.scalingAttribute),
        staminaCost: attack.staminaCost,
        defenderLevel: monster.level,
        defenderScalingValue: monsterAttributes.get(attack.scalingAttribute),
      });
      monsterCurrentHp = Math.max(0, monsterCurrentHp - playerDamage);

      if (attack.appliesEffect) {
        const proced = rollEffectProc(
          { attackerLuck: effectiveAttributes.luck, defenderLuck: monsterAttributes.luck },
          this.rng,
        );
        if (proced) {
          const counterItemId = await resolveCounterItemId(
            attack.appliesEffect,
            this.effectCounterRepository,
          );
          monsterEffects = addBattleEffect(monsterEffects, attack.appliesEffect, {
            inflictorLevel: player.level,
            victimLevel: monster.level,
            counterItemId,
          });
          playerEffectApplied = attack.appliesEffect;
        }
      }

      if (attack.revealsRandomMonsterAttribute) {
        const revealedKey = pickUnrevealedAttribute(revealedMonsterAttributes, this.rng);
        if (revealedKey) {
          revealedMonsterAttributes = [...revealedMonsterAttributes, revealedKey];
          const label = revealedKey.charAt(0).toUpperCase() + revealedKey.slice(1);
          messages.push(
            `You glimpse the monster's ${label}: ${monsterAttributes.get(revealedKey)}!`,
          );
        } else {
          messages.push("You already know everything about this monster.");
        }
      }
    }

    // Step 4: the monster's reply, if it survived the player's strike.
    let monsterAttackResult: TurnReportOutput["monsterAttack"] = null;
    if (monsterCurrentHp > 0) {
      const monsterTurn = await resolveMonsterTurn({
        state: {
          playerCurrentHp,
          monsterCurrentStamina,
          playerEffects,
          monsterChargingAttackId,
          chargeRoundsLeft,
          monsterAttackWeights,
          statusCooldownRoundsLeft,
        },
        monster,
        moveset,
        playerLevel: player.level,
        effectiveAttributes,
        rng: this.rng,
        effectCounterRepository: this.effectCounterRepository,
        statusCooldownRounds: this.statusCooldownRounds,
      });
      playerCurrentHp = monsterTurn.playerCurrentHp;
      monsterCurrentStamina = monsterTurn.monsterCurrentStamina;
      playerEffects = monsterTurn.playerEffects;
      monsterChargingAttackId = monsterTurn.monsterChargingAttackId;
      chargeRoundsLeft = monsterTurn.chargeRoundsLeft;
      monsterAttackWeights = monsterTurn.monsterAttackWeights;
      statusCooldownRoundsLeft = monsterTurn.statusCooldownRoundsLeft;
      monsterAttackResult = monsterTurn.monsterAttack;
      messages.push(...monsterTurn.messages);
    }

    // Step 5: tick active effects (plan2 §6a) — DoT damage both sides, debuff/stun advance, round++.
    const playerTick = tickEffects(playerEffects);
    const monsterTick = tickEffects(monsterEffects);
    playerCurrentHp = Math.max(0, playerCurrentHp - playerTick.totalDamage);
    monsterCurrentHp = Math.max(0, monsterCurrentHp - monsterTick.totalDamage);
    playerEffects = playerTick.remaining;
    monsterEffects = monsterTick.remaining;

    // The player always attacked this turn (never rested), so it always
    // gets the passive +5 on top of whatever the attack spent (plan2 §5).
    playerCurrentStamina = Math.min(
      maxStamina(player.level),
      playerCurrentStamina + BATTLE_CONFIG.passiveStaminaRegen,
    );

    return settleTurn({
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
      monsterAttackWeights,
      statusCooldownRoundsLeft,
      playerAttack: {
        attackName: attack.name,
        hit: playerHit,
        damage: playerDamage,
        effectApplied: playerEffectApplied,
      },
      monsterAttack: monsterAttackResult,
      messages,
      playerMaxHp,
      attributesBeforeDebuff,
      revealedMonsterAttributes,
      rng: this.rng,
      playerRepository: this.playerRepository,
      battleRepository: this.battleRepository,
      levelRepository: this.levelRepository,
      levelUpAttributePoints: this.levelUpAttributePoints,
      dungeonSlayerRankingRepository: this.dungeonSlayerRankingRepository,
      itemRepository: this.itemRepository,
      uniqueItemOwnershipRepository: this.uniqueItemOwnershipRepository,
    });
  }
}
