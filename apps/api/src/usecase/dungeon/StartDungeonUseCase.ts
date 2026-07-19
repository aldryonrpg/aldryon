import {
  canAttemptDungeon,
  nextUtcMidnight,
  recordDungeonAttempt,
} from "@/domain/dungeon/dungeonAttempts";
import { DUNGEON_CONFIG, MINIMUM_DUNGEON_LEVEL } from "@/domain/dungeon/dungeonConfig";
import { dungeonTierForPlayerLevel } from "@/domain/dungeon/dungeonTierForPlayerLevel";
import { scaleMonsterForDungeonStep } from "@/domain/dungeon/scaleMonsterForDungeonStep";
import { Player } from "@/domain/player/Player";
import type { AttributeValues } from "@/domain/shared/Attributes";
import type { Rng } from "@/domain/shared/Rng";
import type { AttackRepository } from "@/usecase/attack/AttackRepository";
import type { BattleRepository } from "@/usecase/battle/BattleRepository";
import type { EffectCounterRepository } from "@/usecase/battle/EffectCounterRepository";
import { BattleAlreadyInProgressError } from "@/usecase/battle/errors";
import type {
  AvailableAttackOutput,
  BattleStatusOutput,
  MonsterStatusOutput,
} from "@/usecase/battle/StartBattleUseCase";
import { beginDungeonFight } from "@/usecase/dungeon/beginDungeonFight";
import {
  BelowMinimumDungeonLevelError,
  DailyDungeonLimitReachedError,
  DungeonRunAlreadyInProgressError,
} from "@/usecase/dungeon/errors";
import type { ItemRepository } from "@/usecase/item/ItemRepository";
import type { LevelRepository } from "@/usecase/level/LevelRepository";
import type { MonsterCatalogCache } from "@/usecase/monster/MonsterCatalogCache";
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

/**
 * POST /dungeon/start (plan3 §2b/§2f, loot-system follow-up). Level-gated,
 * daily-limited, always finds a monster (no empty-encounter roll, unlike
 * /battle/start). Step 1 of the run: picks a random catalog monster and
 * Dungeon Enhances it live for this tier — no new `monsters` row. Rejects
 * (409) if the player already has a dungeon run awaiting a Continue/Exit
 * decision from a previous kill.
 */
export class StartDungeonUseCase {
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

  async execute(input: StartDungeonInput): Promise<StartDungeonOutput> {
    const existingBattle = await this.battleRepository.findByPlayerId(input.playerId);
    if (existingBattle) throw new BattleAlreadyInProgressError();

    let player = await this.playerRepository.findById(input.playerId);
    if (!player) throw new Error("Player not found");

    if (player.dungeonRunTier !== null) {
      throw new DungeonRunAlreadyInProgressError();
    }

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
    const tier = dungeonTierForPlayerLevel(player.level);
    const totalSteps = DUNGEON_CONFIG.stepsPerTier[tier];

    player = await this.playerRepository.update(
      Player.create({
        ...player.toProps(),
        dungeonAttempt1: recorded.dungeonAttempt1,
        dungeonAttempt2: recorded.dungeonAttempt2,
        dungeonRunTier: tier,
        dungeonRunStep: 1,
        dungeonRunTotalSteps: totalSteps,
      }),
    );

    // Starting a run forfeits any unclaimed loot offer, same as /battle/start.
    if (player.pendingLoot.length > 0) {
      player = await this.playerRepository.update(
        Player.create({ ...player.toProps(), pendingLoot: [] }),
      );
    }

    const candidates = await this.monsterRepository.findAllExcludingMaterializedBosses();
    if (candidates.length === 0) throw new Error("No monsters available for the dungeon");
    const rawMonster = pick(candidates, this.rng);
    const monster = scaleMonsterForDungeonStep(rawMonster, tier);

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
      scalingAttribute: attack.scalingAttribute,
      meetsRequirements: attack.meetsRequirements(player.level, effectiveAttributes.toValues()),
    }));

    const result = await beginDungeonFight({
      player,
      monster,
      dungeonTier: tier,
      isBossFight: false,
      playerAttacks,
      effectiveAttributes,
      monsterCatalogCache: this.monsterCatalogCache,
      effectCounterRepository: this.effectCounterRepository,
      levelRepository: this.levelRepository,
      playerRepository: this.playerRepository,
      battleRepository: this.battleRepository,
      rng: this.rng,
    });

    if (result.outcome === "lost") {
      // Death ends the run — clear it rather than leaving it dangling.
      await this.playerRepository.update(
        Player.create({
          ...player.toProps(),
          dungeonRunTier: null,
          dungeonRunStep: null,
          dungeonRunTotalSteps: null,
        }),
      );
    }

    return { ...result, availableAttacks };
  }
}
