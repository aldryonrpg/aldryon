import { Battle } from "@/domain/battle/Battle";
import type { BattleEffect } from "@/domain/battle/BattleEffect";
import { buildBattleEffect, effectAppliedMessage } from "@/domain/battle/BattleEffect";
import { AMBUSH_FLAVOR, maxHp, maxStamina } from "@/domain/battle/battleConfig";
import { computeDamage } from "@/domain/battle/services/DamageCalculator";
import { rollEffectProc } from "@/domain/battle/services/EffectResolver";
import { rollHit } from "@/domain/battle/services/HitCheck";
import {
  canAttemptDungeon,
  nextUtcMidnight,
  recordDungeonAttempt,
} from "@/domain/dungeon/dungeonAttempts";
import { DUNGEON_CONFIG, MINIMUM_DUNGEON_LEVEL } from "@/domain/dungeon/dungeonConfig";
import { dungeonTierForPlayerLevel } from "@/domain/dungeon/dungeonTierForPlayerLevel";
import { scaleDungeonBossStats } from "@/domain/dungeon/scaleDungeonBossStats";
import { Monster } from "@/domain/monster/Monster";
import type { BattleEffectKind } from "@/domain/monster/MonsterAttack";
import { Player } from "@/domain/player/Player";
import type { AttributeValues } from "@/domain/shared/Attributes";
import type { Rng } from "@/domain/shared/Rng";
import type { AttackRepository } from "@/usecase/attack/AttackRepository";
import type { BattleRepository } from "@/usecase/battle/BattleRepository";
import { defaultMonsterAttack, defaultPlayerAttack } from "@/usecase/battle/combatStance";
import { settlePlayerDeath } from "@/usecase/battle/deathSettlement";
import { BattleAlreadyInProgressError } from "@/usecase/battle/errors";
import { resolveCounterItemId } from "@/usecase/battle/resolveCounterItem";
import type {
  AvailableAttackOutput,
  BattleStatusOutput,
} from "@/usecase/battle/StartBattleUseCase";
import type { DungeonBossRepository } from "@/usecase/dungeon/DungeonBossRepository";
import type { DungeonEncounterRepository } from "@/usecase/dungeon/DungeonEncounterRepository";
import {
  BelowMinimumDungeonLevelError,
  DailyDungeonLimitReachedError,
} from "@/usecase/dungeon/errors";
import type { ItemRepository } from "@/usecase/item/ItemRepository";
import type { LevelRepository } from "@/usecase/level/LevelRepository";
import type { MonsterAttackRepository } from "@/usecase/monster/MonsterAttackRepository";
import type { MonsterRepository } from "@/usecase/monster/MonsterRepository";
import { computeEffectiveAttributes } from "@/usecase/player/effectiveAttributes";
import type { PlayerItemRepository } from "@/usecase/player/PlayerItemRepository";
import type { PlayerRepository } from "@/usecase/player/PlayerRepository";

export interface StartDungeonInput {
  playerId: string;
  isVip: boolean;
}

export interface StartDungeonOutput {
  monster: {
    id: string;
    name: string;
    description: string;
    monsterImage: string;
    hp: number;
    attributes: AttributeValues;
  } | null;
  message: string | null;
  playerStatus: BattleStatusOutput | null;
  monsterStatus: BattleStatusOutput | null;
  availableAttacks: AvailableAttackOutput[];
  ambushOccurred: boolean;
  outcome: "ongoing" | "lost" | null;
}

// Materialized dungeon-boss monsters rows need a region to satisfy the
// monsters table's NOT NULL constraint, even though they're never reached
// via an ordinary /battle/start region roll — same acceptable minor overlap
// already accepted for the gatekeeper (an existing wild monster reused
// as-is). Picked once, arbitrarily; thematically fits a Dragon.
const MATERIALIZED_BOSS_REGION = "mountain" as const;

function pick<T>(items: T[], rng: Rng): T {
  const item = items[rng.int(0, items.length - 1)];
  if (item === undefined) throw new Error("Cannot pick from an empty list");
  return item;
}

/**
 * POST /dungeon/start (plan3 §2b-§2d, §5). Level-gated, daily-limited,
 * always encounters the gatekeeper (no empty-encounter roll, unlike
 * /battle/start) — the boss is materialized eagerly here but only enters
 * the fight later, via settleTurn's phase transition on the gatekeeper's
 * death.
 */
export class StartDungeonUseCase {
  constructor(
    private readonly playerRepository: PlayerRepository,
    private readonly playerItemRepository: PlayerItemRepository,
    private readonly itemRepository: ItemRepository,
    private readonly battleRepository: BattleRepository,
    private readonly monsterRepository: MonsterRepository,
    private readonly monsterAttackRepository: MonsterAttackRepository,
    private readonly attackRepository: AttackRepository,
    private readonly levelRepository: LevelRepository,
    private readonly dungeonEncounterRepository: DungeonEncounterRepository,
    private readonly dungeonBossRepository: DungeonBossRepository,
    private readonly rng: Rng,
  ) {}

  async execute(input: StartDungeonInput): Promise<StartDungeonOutput> {
    const existingBattle = await this.battleRepository.findByPlayerId(input.playerId);
    if (existingBattle) throw new BattleAlreadyInProgressError();

    let player = await this.playerRepository.findById(input.playerId);
    if (!player) throw new Error("Player not found");

    if (player.level < MINIMUM_DUNGEON_LEVEL) {
      throw new BelowMinimumDungeonLevelError(player.level, MINIMUM_DUNGEON_LEVEL);
    }

    const now = new Date();
    if (!canAttemptDungeon(player.dungeonAttempt1, player.dungeonAttempt2, input.isVip, now)) {
      throw new DailyDungeonLimitReachedError(nextUtcMidnight(now));
    }

    // Entering (writing the attempt column) happens before the encounter is
    // picked, so a crash mid-setup still counts against the day (plan3 §2f).
    const recorded = recordDungeonAttempt(player.dungeonAttempt1, player.dungeonAttempt2, now);
    player = await this.playerRepository.update(
      Player.create({
        ...player.toProps(),
        dungeonAttempt1: recorded.dungeonAttempt1,
        dungeonAttempt2: recorded.dungeonAttempt2,
      }),
    );

    // Starting a run forfeits any unclaimed loot offer, same as /battle/start.
    if (player.pendingLoot.length > 0) {
      player = await this.playerRepository.update(
        Player.create({ ...player.toProps(), pendingLoot: [] }),
      );
    }

    const tier = dungeonTierForPlayerLevel(player.level);

    const encounter = await this.dungeonEncounterRepository.findOne();
    if (!encounter) throw new Error("No dungeon encounter configured");

    const dungeonBoss = await this.dungeonBossRepository.findById(encounter.dungeonBossId);
    if (!dungeonBoss) throw new Error("Dungeon boss not found");

    // Materialize-or-reuse: idempotent by name, one row ever per tier
    // (plan3 §2c).
    const materializedName = `${dungeonBoss.name} — Tier ${tier}`;
    let bossMonster = await this.monsterRepository.findByName(materializedName);
    if (!bossMonster) {
      const scaled = scaleDungeonBossStats(
        {
          hp: dungeonBoss.baseHp,
          xpGain: dungeonBoss.baseXpGain,
          attributes: dungeonBoss.baseAttributes,
        },
        tier,
      );
      bossMonster = await this.monsterRepository.create(
        Monster.create({
          id: Bun.randomUUIDv7(),
          name: materializedName,
          description: dungeonBoss.description,
          region: MATERIALIZED_BOSS_REGION,
          monsterImage: dungeonBoss.monsterImage,
          hp: scaled.hp,
          xpGain: scaled.xpGain,
          level: DUNGEON_CONFIG.tierBossLevel[tier],
          maxStamina: dungeonBoss.baseMaxStamina,
          attributes: scaled.attributes,
          monsterType: dungeonBoss.monsterType,
          drops: dungeonBoss.drops,
          exclusiveDrops: dungeonBoss.exclusiveDrops,
          legendaryDrops: dungeonBoss.legendaryDrops,
          ambushChance: 0,
        }),
      );
      await this.monsterAttackRepository.copyDungeonBossMoveset(dungeonBoss.id, bossMonster.id);
    }

    const gatekeeper = await this.monsterRepository.findById(encounter.gatekeeperMonsterId);
    if (!gatekeeper) throw new Error("Gatekeeper monster not found");
    const moveset = await this.monsterAttackRepository.findMovesetByMonsterId(gatekeeper.id);

    const playerAttacks = await this.attackRepository.findAll();
    const effectiveAttributes = await computeEffectiveAttributes(
      player,
      this.playerItemRepository,
      this.itemRepository,
    );
    const availableAttacks: AvailableAttackOutput[] = playerAttacks.map((attack) => ({
      name: attack.name,
      staminaCost: attack.staminaCost,
      scalingAttribute: attack.scalingAttribute,
      meetsRequirements: attack.meetsRequirements(player.level, effectiveAttributes.toValues()),
    }));

    const playerMaxHp = maxHp(effectiveAttributes.vitality, effectiveAttributes.force);
    const playerMaxStamina = maxStamina(player.level);
    const gatekeeperMaxStamina = gatekeeper.maxStamina;

    let playerCurrentHp = playerMaxHp;
    let ambushOccurred = false;
    let playerEffects: BattleEffect[] = [];
    let ambushEffectMessage: string | null = null;

    // Ambush can still roll normally on top of the guaranteed encounter
    // (only the "is there an encounter at all" roll is skipped for the
    // dungeon, not the ambush roll).
    if (this.rng.int(1, 100) <= gatekeeper.ambushChance) {
      ambushOccurred = true;
      const nonSpecialMoveset = moveset.filter((a) => !a.isSpecial);
      const ambushAttack =
        nonSpecialMoveset.length > 0
          ? pick(nonSpecialMoveset, this.rng)
          : defaultMonsterAttack(moveset);

      const hit = rollHit(
        {
          attackerDexterity: gatekeeper.getAttributes().dexterity,
          defenderDexterity: effectiveAttributes.dexterity,
          attackerLuck: gatekeeper.getAttributes().luck,
        },
        this.rng,
      );

      if (hit) {
        const defenderStance = defaultPlayerAttack(playerAttacks);
        const damage = computeDamage({
          attackMultiplier: ambushAttack.multiplier,
          attackerScalingValue: gatekeeper.getAttributes().get(ambushAttack.scalingAttribute),
          staminaCost: ambushAttack.staminaCost,
          defenderLevel: player.level,
          defenderScalingValue: effectiveAttributes.get(defenderStance.scalingAttribute),
        });
        playerCurrentHp = Math.max(0, playerCurrentHp - damage);

        const proced = rollEffectProc(
          {
            attackerLuck: gatekeeper.getAttributes().luck,
            defenderLuck: effectiveAttributes.luck,
          },
          this.rng,
        );
        if (proced) {
          const kind: BattleEffectKind = ambushAttack.appliesEffect ?? gatekeeper.innateEffectKind;
          const counterItemId = ambushAttack.appliesEffect
            ? ambushAttack.counterItemId
            : await resolveCounterItemId(kind, this.itemRepository);
          playerEffects = [
            ...playerEffects,
            buildBattleEffect(kind, {
              inflictorLevel: gatekeeper.level,
              victimLevel: player.level,
              counterItemId,
            }),
          ];
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
      monsterId: gatekeeper.id,
      playerCurrentHp,
      playerCurrentStamina: playerMaxStamina,
      monsterCurrentHp: gatekeeper.hp,
      monsterCurrentStamina: gatekeeperMaxStamina,
      round: 1,
      playerEffects,
      monsterEffects: [],
      monsterChargingAttackId: null,
      chargeRoundsLeft: 0,
      monsterAttackWeights: {},
      stunCooldownRoundsLeft: 0,
      dungeonBossMonsterId: bossMonster.id,
      dungeonTier: tier,
    });
    await this.battleRepository.create(battle);

    return {
      monster: {
        id: gatekeeper.id,
        name: gatekeeper.name,
        description: gatekeeper.description,
        monsterImage: gatekeeper.monsterImage,
        hp: gatekeeper.hp,
        attributes: gatekeeper.getAttributes().toValues(),
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
        currentHp: gatekeeper.hp,
        maxHp: gatekeeper.hp,
        currentStamina: gatekeeperMaxStamina,
        maxStamina: gatekeeperMaxStamina,
      },
      availableAttacks,
      ambushOccurred,
      outcome: "ongoing",
    };
  }
}
