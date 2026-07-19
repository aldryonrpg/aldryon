import { Battle } from "@/domain/battle/Battle";
import type { BattleEffect } from "@/domain/battle/BattleEffect";
import { addBattleEffect, effectAppliedMessage } from "@/domain/battle/BattleEffect";
import {
  AMBUSH_FLAVOR,
  BATTLE_CONFIG,
  EMPTY_ENCOUNTER_FLAVOR,
  maxHp,
  maxStamina,
} from "@/domain/battle/battleConfig";
import { computeDamage } from "@/domain/battle/services/DamageCalculator";
import { rollEffectProc } from "@/domain/battle/services/EffectResolver";
import { rollHit } from "@/domain/battle/services/HitCheck";
import type { MonsterRegion } from "@/domain/monster/Monster";
import type { AttackScaling, BattleEffectKind } from "@/domain/monster/MonsterAttack";
import { Player } from "@/domain/player/Player";
import type { AttributeValues } from "@/domain/shared/Attributes";
import type { Rng } from "@/domain/shared/Rng";
import type { AttackRepository } from "@/usecase/attack/AttackRepository";
import type { BattleRepository } from "@/usecase/battle/BattleRepository";
import { defaultMonsterAttack } from "@/usecase/battle/combatStance";
import { settlePlayerDeath } from "@/usecase/battle/deathSettlement";
import type { EffectCounterRepository } from "@/usecase/battle/EffectCounterRepository";
import { BattleAlreadyInProgressError, RunCooldownError } from "@/usecase/battle/errors";
import { resolveCounterItemId } from "@/usecase/battle/resolveCounterItem";
import type { BattleStatusOutput, MonsterStatusOutput } from "@/usecase/battle/TurnReportOutput";
import type { ItemRepository } from "@/usecase/item/ItemRepository";
import type { LevelRepository } from "@/usecase/level/LevelRepository";
import type { MonsterCatalogCache } from "@/usecase/monster/MonsterCatalogCache";
import type { MonsterRepository } from "@/usecase/monster/MonsterRepository";
import { computeEffectiveAttributes } from "@/usecase/player/effectiveAttributes";
import type { PlayerItemRepository } from "@/usecase/player/PlayerItemRepository";
import type { PlayerRepository } from "@/usecase/player/PlayerRepository";

export interface StartBattleInput {
  playerId: string;
  region: MonsterRegion;
}

export type { BattleStatusOutput, MonsterStatusOutput };

export interface AvailableAttackOutput {
  name: string;
  staminaCost: number;
  multiplier: number;
  scalingAttribute: AttackScaling;
  meetsRequirements: boolean;
  revealsRandomMonsterAttribute: boolean;
}

export interface StartBattleOutput {
  monster: {
    id: string;
    name: string;
    description: string;
    monsterImage: string;
    hp: number;
    /** Only revealed keys are present — hidden ("??" client-side) otherwise. */
    attributes: Partial<AttributeValues>;
  } | null;
  message: string | null;
  playerStatus: BattleStatusOutput | null;
  monsterStatus: MonsterStatusOutput | null;
  availableAttacks: AvailableAttackOutput[];
  ambushOccurred: boolean;
  outcome: "ongoing" | "lost" | null;
}

function pick<T>(items: T[], rng: Rng): T {
  const item = items[rng.int(0, items.length - 1)];
  if (item === undefined) throw new Error("Cannot pick from an empty list");
  return item;
}

/** Battle start (plan2 §4). */
export class StartBattleUseCase {
  constructor(
    private readonly playerRepository: PlayerRepository,
    private readonly playerItemRepository: PlayerItemRepository,
    private readonly itemRepository: ItemRepository,
    private readonly battleRepository: BattleRepository,
    private readonly monsterRepository: MonsterRepository,
    private readonly monsterCatalogCache: MonsterCatalogCache,
    private readonly attackRepository: AttackRepository,
    private readonly levelRepository: LevelRepository,
    private readonly rng: Rng,
    private readonly effectCounterRepository: EffectCounterRepository,
    private readonly setAttributeBonus: number,
  ) {}

  async execute(input: StartBattleInput): Promise<StartBattleOutput> {
    const existingBattle = await this.battleRepository.findByPlayerId(input.playerId);
    if (existingBattle) throw new BattleAlreadyInProgressError();

    let player = await this.playerRepository.findById(input.playerId);
    if (!player) throw new Error("Player not found");

    // Starting the next battle forfeits any unclaimed loot offer (plan2 §5e).
    if (player.pendingLoot.length > 0) {
      player = await this.playerRepository.update(
        Player.create({ ...player.toProps(), pendingLoot: [] }),
      );
    }

    // Run cooldown (plan2 §4 step 1a) — dying has no cooldown, only fleeing does.
    if (player.lastRunAt) {
      const cooldownSeconds = player.isVip
        ? BATTLE_CONFIG.runCooldownSecondsVip
        : BATTLE_CONFIG.runCooldownSeconds;
      const elapsedSeconds = (Date.now() - player.lastRunAt.getTime()) / 1000;
      if (elapsedSeconds < cooldownSeconds) {
        throw new RunCooldownError(Math.ceil(cooldownSeconds - elapsedSeconds));
      }
    }

    const playerAttacks = await this.attackRepository.findAll();
    const effectiveAttributes = await computeEffectiveAttributes(
      player,
      this.playerItemRepository,
      this.itemRepository,
      this.setAttributeBonus,
    );
    const availableAttacks: AvailableAttackOutput[] = playerAttacks.map((attack) => ({
      name: attack.name,
      staminaCost: attack.staminaCost,
      multiplier: attack.multiplier,
      scalingAttribute: attack.scalingAttribute,
      meetsRequirements: attack.meetsRequirements(player.level, effectiveAttributes.toValues()),
      revealsRandomMonsterAttribute: attack.revealsRandomMonsterAttribute,
    }));

    // 20% of the time: find nothing (plan2 §4 step 2).
    if (this.rng.int(1, 100) <= Math.round(BATTLE_CONFIG.emptyEncounterChance * 100)) {
      return {
        monster: null,
        message: pick([...EMPTY_ENCOUNTER_FLAVOR], this.rng),
        playerStatus: null,
        monsterStatus: null,
        availableAttacks,
        ambushOccurred: false,
        outcome: null,
      };
    }

    const monsters = await this.monsterRepository.findAllByRegion(input.region);
    if (monsters.length === 0) {
      return {
        monster: null,
        message: pick([...EMPTY_ENCOUNTER_FLAVOR], this.rng),
        playerStatus: null,
        monsterStatus: null,
        availableAttacks,
        ambushOccurred: false,
        outcome: null,
      };
    }

    const monster = pick(monsters, this.rng);
    const moveset = await this.monsterCatalogCache.getMoveset(monster.id);

    const playerMaxHp = maxHp(effectiveAttributes.vitality, effectiveAttributes.strength);
    const playerMaxStamina = maxStamina(player.level);
    const monsterMaxStamina = monster.maxStamina;

    let playerCurrentHp = playerMaxHp;
    let ambushOccurred = false;
    let playerEffects: BattleEffect[] = [];
    let ambushEffectMessage: string | null = null;

    // Ambush roll (plan2 §4 step 4): one free monster strike before the
    // player ever acts. Can't use a special.
    if (this.rng.int(1, 100) <= monster.ambushChance) {
      ambushOccurred = true;
      const nonSpecialMoveset = moveset.filter((a) => !a.isSpecial);
      const ambushAttack =
        nonSpecialMoveset.length > 0
          ? pick(nonSpecialMoveset, this.rng)
          : defaultMonsterAttack(moveset);

      const hit = rollHit(
        {
          attackerDexterity: monster.getAttributes().dexterity,
          defenderAgility: effectiveAttributes.agility,
          attackerLuck: monster.getAttributes().luck,
        },
        this.rng,
      );

      if (hit) {
        const damage = computeDamage({
          attackMultiplier: ambushAttack.multiplier,
          attackerScalingValue: monster.getAttributes().get(ambushAttack.scalingAttribute),
          staminaCost: ambushAttack.staminaCost,
          defenderLevel: player.level,
          defenderScalingValue: effectiveAttributes.get(ambushAttack.scalingAttribute),
        });
        playerCurrentHp = Math.max(0, playerCurrentHp - damage);

        // Effect procs apply on an ambush exactly like any other monster hit
        // (plan2 §4 step 4 — "normal combat math", which includes §6a's proc
        // roll), so the innate/attack-specific DoT can land here too.
        const proced = rollEffectProc(
          {
            attackerLuck: monster.getAttributes().luck,
            defenderLuck: effectiveAttributes.luck,
          },
          this.rng,
        );
        if (proced) {
          const kind: BattleEffectKind = ambushAttack.appliesEffect ?? monster.innateEffectKind;
          const counterItemId = await resolveCounterItemId(kind, this.effectCounterRepository);
          playerEffects = addBattleEffect(playerEffects, kind, {
            inflictorLevel: monster.level,
            victimLevel: player.level,
            counterItemId,
          });
          ambushEffectMessage = effectAppliedMessage(kind);
        }
      }
    }

    if (playerCurrentHp <= 0) {
      await settlePlayerDeath(player, this.levelRepository, this.playerRepository);
      return {
        monster: null,
        message: pick([...AMBUSH_FLAVOR], this.rng),
        playerStatus: null,
        monsterStatus: null,
        availableAttacks,
        ambushOccurred: true,
        outcome: "lost",
      };
    }

    const battle = Battle.create({
      id: Bun.randomUUIDv7(),
      playerId: player.id,
      monsterId: monster.id,
      playerCurrentHp,
      playerCurrentStamina: playerMaxStamina,
      monsterCurrentHp: monster.hp,
      monsterCurrentStamina: monsterMaxStamina,
      round: 1,
      playerEffects,
      monsterEffects: [],
      monsterChargingAttackId: null,
      chargeRoundsLeft: 0,
      monsterAttackWeights: {},
      statusCooldownRoundsLeft: 0,
      dungeonTier: null,
      dungeonIsBossFight: false,
      revealedMonsterAttributes: [],
    });
    await this.battleRepository.create(battle);

    return {
      monster: {
        id: monster.id,
        name: monster.name,
        description: monster.description,
        monsterImage: monster.monsterImage,
        hp: monster.hp,
        // Fresh battle — nothing revealed yet.
        attributes: {},
      },
      message: ambushOccurred
        ? [pick([...AMBUSH_FLAVOR], this.rng), ambushEffectMessage].filter(Boolean).join(" ")
        : null,
      playerStatus: {
        currentHp: playerCurrentHp,
        maxHp: playerMaxHp,
        currentStamina: playerMaxStamina,
        maxStamina: playerMaxStamina,
      },
      monsterStatus: {
        currentHp: monster.hp,
        maxHp: monster.hp,
      },
      availableAttacks,
      ambushOccurred,
      outcome: "ongoing",
    };
  }
}
