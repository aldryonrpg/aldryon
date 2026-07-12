import { Battle } from "@/domain/battle/Battle";
import { computeDotMagnitude, tickEffects } from "@/domain/battle/BattleEffect";
import {
  BATTLE_CONFIG,
  CHARGE_WARNING_FLAVOR,
  maxHp,
  maxStamina,
} from "@/domain/battle/battleConfig";
import { computeDamage } from "@/domain/battle/services/DamageCalculator";
import { rollEffectProc } from "@/domain/battle/services/EffectResolver";
import { rollHit } from "@/domain/battle/services/HitCheck";
import { applyXpGain } from "@/domain/level/LevelCurve";
import { rollDropPool } from "@/domain/monster/dropRoll";
import type { BattleEffectKind } from "@/domain/monster/MonsterAttack";
import { Player } from "@/domain/player/Player";
import type { Rng } from "@/domain/shared/Rng";
import type { AttackRepository } from "@/usecase/attack/AttackRepository";
import type { BattleRepository } from "@/usecase/battle/BattleRepository";
import { defaultMonsterAttack, defaultPlayerAttack } from "@/usecase/battle/combatStance";
import { settlePlayerDeath } from "@/usecase/battle/deathSettlement";
import {
  AttackNotUsableError,
  NoActiveBattleError,
  UnknownAttackError,
} from "@/usecase/battle/errors";
import { resolveCounterItemId } from "@/usecase/battle/resolveCounterItem";
import type { TurnReportOutput } from "@/usecase/battle/TurnReportOutput";
import type { ItemRepository } from "@/usecase/item/ItemRepository";
import type { LevelRepository } from "@/usecase/level/LevelRepository";
import type { MonsterAttackRepository } from "@/usecase/monster/MonsterAttackRepository";
import type { MonsterRepository } from "@/usecase/monster/MonsterRepository";
import { computeEffectiveAttributes } from "@/usecase/player/effectiveAttributes";
import type { PlayerItemRepository } from "@/usecase/player/PlayerItemRepository";
import type { PlayerRepository } from "@/usecase/player/PlayerRepository";

export interface AttackInput {
  playerId: string;
  attackName: string;
}

function pick<T>(items: readonly T[], rng: Rng): T {
  const item = items[rng.int(0, items.length - 1)];
  if (item === undefined) throw new Error("Cannot pick from an empty list");
  return item;
}

/**
 * A full battle turn (plan2 §5a): player's strike, monster's reply (incl.
 * the charge/unleash state machine), effect ticks, and kill/death
 * settlement. The largest single use case in plan2 — most of §6/§6a lives
 * here.
 */
export class AttackUseCase {
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
  ) {}

  async execute(input: AttackInput): Promise<TurnReportOutput> {
    const battle = await this.battleRepository.findByPlayerId(input.playerId);
    if (!battle) throw new NoActiveBattleError();

    const player = await this.playerRepository.findById(input.playerId);
    if (!player) throw new Error("Player not found");

    const monster = await this.monsterRepository.findById(battle.monsterId);
    if (!monster) throw new Error("Monster not found");

    const [playerAttacks, moveset, effectiveAttributes] = await Promise.all([
      this.attackRepository.findAll(),
      this.monsterAttackRepository.findMovesetByMonsterId(monster.id),
      computeEffectiveAttributes(player, this.playerItemRepository, this.itemRepository),
    ]);

    const attack = playerAttacks.find((a) => a.name === input.attackName);
    if (!attack) throw new UnknownAttackError(input.attackName);
    if (battle.playerCurrentStamina < attack.staminaCost) {
      throw new AttackNotUsableError("Not enough stamina for this attack");
    }
    if (!attack.meetsRequirements(player.level, effectiveAttributes.toValues())) {
      throw new AttackNotUsableError("Attack requirements not met");
    }

    const monsterAttributes = monster.getAttributes();
    const playerMaxHp = maxHp(effectiveAttributes.vitality, effectiveAttributes.force);
    const messages: string[] = [];

    let monsterCurrentHp = battle.monsterCurrentHp;
    let playerCurrentStamina = battle.playerCurrentStamina - attack.staminaCost;
    let monsterCurrentStamina = battle.monsterCurrentStamina;
    let playerCurrentHp = battle.playerCurrentHp;
    let playerEffects = battle.playerEffects;
    let monsterEffects = battle.monsterEffects;
    let monsterChargingAttackId = battle.monsterChargingAttackId;
    let chargeRoundsLeft = battle.chargeRoundsLeft;

    // Step 1-3: resolve the player's strike (plan2 §6).
    const playerHit = rollHit(
      {
        attackerDexterity: effectiveAttributes.dexterity,
        defenderDexterity: monsterAttributes.dexterity,
        attackerLuck: effectiveAttributes.luck,
      },
      this.rng,
    );

    let playerDamage = 0;
    let playerEffectApplied: string | null = null;

    if (playerHit) {
      const monsterStance = defaultMonsterAttack(moveset);
      playerDamage = computeDamage({
        attackMultiplier: attack.multiplier,
        attackerScalingValue: effectiveAttributes.get(attack.scalingAttribute),
        staminaCost: attack.staminaCost,
        defenderLevel: monster.level,
        defenderScalingValue: monsterAttributes.get(monsterStance.scalingAttribute),
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
            this.itemRepository,
          );
          monsterEffects = [
            ...monsterEffects,
            {
              type: "dot",
              kind: attack.appliesEffect,
              damagePerRound: computeDotMagnitude(player.level, monster.level),
              counterItemId,
            },
          ];
          playerEffectApplied = attack.appliesEffect;
        }
      }
    }

    // Step 4: the monster's reply, if it survived the player's strike.
    let monsterAttackName: string | null = null;
    let monsterHit = false;
    let monsterDamage = 0;
    let monsterEffectApplied: string | null = null;

    // Both sides passively recover 5 Stamina at the end of every round;
    // resting/charging recovers 15 INSTEAD of the 5 (not additive, plan2
    // §5). Default to the passive rate and override per branch below.
    let monsterStaminaRegen: number = BATTLE_CONFIG.passiveStaminaRegen;

    if (monsterCurrentHp > 0) {
      if (battle.isMonsterCharging) {
        chargeRoundsLeft -= 1;
        if (chargeRoundsLeft > 0) {
          monsterStaminaRegen = BATTLE_CONFIG.restStaminaRegen;
          messages.push(pick(CHARGE_WARNING_FLAVOR, this.rng));
        } else {
          const special = moveset.find((a) => a.id === monsterChargingAttackId);
          if (!special) throw new Error("Charging monster attack no longer exists in its moveset");

          monsterAttackName = special.name;
          monsterHit = true;
          const playerStance = defaultPlayerAttack(playerAttacks);
          monsterDamage = computeDamage({
            attackMultiplier: special.multiplier,
            attackerScalingValue: monsterAttributes.get(special.scalingAttribute),
            staminaCost: special.staminaCost,
            defenderLevel: player.level,
            defenderScalingValue: effectiveAttributes.get(playerStance.scalingAttribute),
          });
          playerCurrentHp = Math.max(0, playerCurrentHp - monsterDamage);
          monsterCurrentStamina = Math.max(0, monsterCurrentStamina - special.staminaCost);

          const innateKind = monster.innateEffectKind;
          const innateCounter = await resolveCounterItemId(innateKind, this.itemRepository);
          playerEffects = [
            ...playerEffects,
            {
              type: "dot",
              kind: innateKind,
              damagePerRound: computeDotMagnitude(monster.level, player.level),
              counterItemId: innateCounter,
            },
          ];
          monsterEffectApplied = innateKind;

          if (special.appliesEffect && special.appliesEffect !== innateKind) {
            playerEffects = [
              ...playerEffects,
              {
                type: "dot",
                kind: special.appliesEffect,
                damagePerRound: computeDotMagnitude(monster.level, player.level),
                counterItemId: special.counterItemId,
              },
            ];
          }

          monsterChargingAttackId = null;
          chargeRoundsLeft = 0;
        }
      } else {
        const affordable = moveset.filter((a) => a.staminaCost <= monsterCurrentStamina);
        if (affordable.length === 0) {
          monsterStaminaRegen = BATTLE_CONFIG.restStaminaRegen;
        } else {
          const picked = pick(affordable, this.rng);
          if (picked.isSpecial) {
            monsterStaminaRegen = BATTLE_CONFIG.restStaminaRegen;
            monsterChargingAttackId = picked.id;
            chargeRoundsLeft = picked.chargeTurns;
            messages.push(pick(CHARGE_WARNING_FLAVOR, this.rng));
          } else {
            monsterAttackName = picked.name;
            monsterHit = rollHit(
              {
                attackerDexterity: monsterAttributes.dexterity,
                defenderDexterity: effectiveAttributes.dexterity,
                attackerLuck: monsterAttributes.luck,
              },
              this.rng,
            );

            if (monsterHit) {
              const playerStance = defaultPlayerAttack(playerAttacks);
              monsterDamage = computeDamage({
                attackMultiplier: picked.multiplier,
                attackerScalingValue: monsterAttributes.get(picked.scalingAttribute),
                staminaCost: picked.staminaCost,
                defenderLevel: player.level,
                defenderScalingValue: effectiveAttributes.get(playerStance.scalingAttribute),
              });
              playerCurrentHp = Math.max(0, playerCurrentHp - monsterDamage);
              monsterCurrentStamina = Math.max(0, monsterCurrentStamina - picked.staminaCost);

              const proced = rollEffectProc(
                { attackerLuck: monsterAttributes.luck, defenderLuck: effectiveAttributes.luck },
                this.rng,
              );
              if (proced) {
                const kind: BattleEffectKind = picked.appliesEffect ?? monster.innateEffectKind;
                const counterItemId = picked.appliesEffect
                  ? picked.counterItemId
                  : await resolveCounterItemId(kind, this.itemRepository);
                playerEffects = [
                  ...playerEffects,
                  {
                    type: "dot",
                    kind,
                    damagePerRound: computeDotMagnitude(monster.level, player.level),
                    counterItemId,
                  },
                ];
                monsterEffectApplied = kind;
              }
            } else {
              monsterCurrentStamina = Math.max(0, monsterCurrentStamina - picked.staminaCost);
            }
          }
        }
      }

      monsterCurrentStamina = Math.min(
        maxStamina(monster.level),
        monsterCurrentStamina + monsterStaminaRegen,
      );
    }

    // Step 5: tick active effects (plan2 §6a) — DoT damage both sides, debuff expiry, round++.
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

    // Step 6-7: settlement.
    if (monsterCurrentHp <= 0) {
      const levels = await this.levelRepository.findAll();
      const xpResult = applyXpGain({
        levels,
        currentXp: player.xp,
        currentLevel: player.level,
        xpGain: monster.xpGain,
        maxXp: BATTLE_CONFIG.maxXp,
        attributePointsPerLevel: this.levelUpAttributePoints,
      });

      const dropItemId = rollDropPool(monster.drops, this.rng);
      const exclusiveDropItemId = rollDropPool(monster.exclusiveDrops, this.rng);
      const lootOffer = [dropItemId, exclusiveDropItemId].filter((id): id is string => id !== null);

      const updatedPlayer = Player.create({
        ...player.toProps(),
        xp: xpResult.xp,
        level: xpResult.level,
        attributePoints: player.attributePoints + xpResult.attributePointsGained,
        pendingLoot: lootOffer,
      });
      await this.playerRepository.update(updatedPlayer);
      await this.battleRepository.deleteByPlayerId(player.id);

      return this.buildReport({
        playerAttackName: attack.name,
        playerHit,
        playerDamage,
        playerEffectApplied,
        monsterAttackName,
        monsterHit,
        monsterDamage,
        monsterEffectApplied,
        messages,
        playerCurrentHp,
        playerCurrentStamina,
        monsterCurrentHp: 0,
        monsterCurrentStamina,
        playerMaxHp,
        playerLevel: player.level,
        monsterMaxHp: monster.hp,
        monsterLevel: monster.level,
        outcome: "won",
        lootOffer,
      });
    }

    if (playerCurrentHp <= 0) {
      await settlePlayerDeath(player, this.levelRepository, this.playerRepository);
      await this.battleRepository.deleteByPlayerId(player.id);

      return this.buildReport({
        playerAttackName: attack.name,
        playerHit,
        playerDamage,
        playerEffectApplied,
        monsterAttackName,
        monsterHit,
        monsterDamage,
        monsterEffectApplied,
        messages,
        playerCurrentHp: 0,
        playerCurrentStamina,
        monsterCurrentHp,
        monsterCurrentStamina,
        playerMaxHp,
        playerLevel: player.level,
        monsterMaxHp: monster.hp,
        monsterLevel: monster.level,
        outcome: "lost",
        lootOffer: null,
      });
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
    await this.battleRepository.update(updatedBattle);

    return this.buildReport({
      playerAttackName: attack.name,
      playerHit,
      playerDamage,
      playerEffectApplied,
      monsterAttackName,
      monsterHit,
      monsterDamage,
      monsterEffectApplied,
      messages,
      playerCurrentHp,
      playerCurrentStamina,
      monsterCurrentHp,
      monsterCurrentStamina,
      playerMaxHp,
      playerLevel: player.level,
      monsterMaxHp: monster.hp,
      monsterLevel: monster.level,
      outcome: "ongoing",
      lootOffer: null,
    });
  }

  private buildReport(params: {
    playerAttackName: string;
    playerHit: boolean;
    playerDamage: number;
    playerEffectApplied: string | null;
    monsterAttackName: string | null;
    monsterHit: boolean;
    monsterDamage: number;
    monsterEffectApplied: string | null;
    messages: string[];
    playerCurrentHp: number;
    playerCurrentStamina: number;
    monsterCurrentHp: number;
    monsterCurrentStamina: number;
    playerMaxHp: number;
    playerLevel: number;
    monsterMaxHp: number;
    monsterLevel: number;
    outcome: "ongoing" | "won" | "lost";
    lootOffer: string[] | null;
  }): TurnReportOutput {
    return {
      playerAttack: {
        attackName: params.playerAttackName,
        hit: params.playerHit,
        damage: params.playerDamage,
        effectApplied: params.playerEffectApplied,
      },
      monsterAttack: params.monsterAttackName
        ? {
            attackName: params.monsterAttackName,
            hit: params.monsterHit,
            damage: params.monsterDamage,
            effectApplied: params.monsterEffectApplied,
          }
        : null,
      messages: params.messages,
      playerStatus: {
        currentHp: params.playerCurrentHp,
        maxHp: params.playerMaxHp,
        currentStamina: params.playerCurrentStamina,
        maxStamina: maxStamina(params.playerLevel),
      },
      monsterStatus: {
        currentHp: params.monsterCurrentHp,
        maxHp: params.monsterMaxHp,
        currentStamina: params.monsterCurrentStamina,
        maxStamina: maxStamina(params.monsterLevel),
      },
      outcome: params.outcome,
      lootOffer: params.lootOffer,
    };
  }
}
