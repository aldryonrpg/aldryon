import { rollGrowlBreakPercent } from "@/domain/dungeon/growlRoll";
import { scaleMonsterForDungeonStep } from "@/domain/dungeon/scaleMonsterForDungeonStep";
import type { Monster } from "@/domain/monster/Monster";
import { POT_ITEM_NAMES, planGrowlPotBreak } from "@/domain/player/Bag";
import { Player } from "@/domain/player/Player";
import { PlayerItem } from "@/domain/player/PlayerItem";
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
import type { DungeonBossOfTheDayUseCase } from "@/usecase/dungeon/DungeonBossOfTheDayUseCase";
import { NoDungeonRunInProgressError } from "@/usecase/dungeon/errors";
import type { ItemRepository } from "@/usecase/item/ItemRepository";
import type { LevelRepository } from "@/usecase/level/LevelRepository";
import type { MonsterCatalogCache } from "@/usecase/monster/MonsterCatalogCache";
import type { MonsterRepository } from "@/usecase/monster/MonsterRepository";
import { computeEffectiveAttributes } from "@/usecase/player/effectiveAttributes";
import type { PlayerItemRepository } from "@/usecase/player/PlayerItemRepository";
import type { PlayerRepository } from "@/usecase/player/PlayerRepository";

function pick<T>(items: T[], rng: Rng): T {
  const item = items[rng.int(0, items.length - 1)];
  if (item === undefined) throw new Error("Cannot pick from an empty list");
  return item;
}

export interface ContinueDungeonInput {
  playerId: string;
}

export interface ContinueDungeonOutput {
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
  outcome: "ongoing" | "lost";
}

/**
 * POST /dungeon/continue (loot-system follow-up) — the explicit click that
 * advances a dungeon run to its next step, or reveals the boss once the
 * last step is done. Every step's kill fully settles and deletes its own
 * battle (settleTurn), so this is what picks the next fight back up using
 * the run progress parked on the player row by /dungeon/start.
 */
export class ContinueDungeonUseCase {
  constructor(
    private readonly playerRepository: PlayerRepository,
    private readonly playerItemRepository: PlayerItemRepository,
    private readonly itemRepository: ItemRepository,
    private readonly battleRepository: BattleRepository,
    private readonly monsterRepository: MonsterRepository,
    private readonly monsterCatalogCache: MonsterCatalogCache,
    private readonly attackRepository: AttackRepository,
    private readonly levelRepository: LevelRepository,
    private readonly dungeonBossOfTheDayUseCase: DungeonBossOfTheDayUseCase,
    private readonly rng: Rng,
    private readonly effectCounterRepository: EffectCounterRepository,
    private readonly setAttributeBonus: number,
  ) {}

  async execute(input: ContinueDungeonInput): Promise<ContinueDungeonOutput> {
    const existingBattle = await this.battleRepository.findByPlayerId(input.playerId);
    if (existingBattle) throw new BattleAlreadyInProgressError();

    const player = await this.playerRepository.findById(input.playerId);
    if (!player) throw new Error("Player not found");

    const { dungeonRunTier: tier, dungeonRunStep: step, dungeonRunTotalSteps: totalSteps } = player;
    if (tier === null || step === null || totalSteps === null) {
      throw new NoDungeonRunInProgressError();
    }

    const playerAttacks = await this.attackRepository.findAll();
    const effectiveAttributes = await computeEffectiveAttributes(
      player,
      this.playerItemRepository,
      this.itemRepository,
      this.setAttributeBonus,
    );
    // Attacks the player hasn't unlocked never leave the API — fresh fight,
    // no debuffs active yet.
    const availableAttacks: AvailableAttackOutput[] = playerAttacks
      .filter((attack) => attack.meetsRequirements(player.level, effectiveAttributes.toValues()))
      .map((attack) => ({
        name: attack.name,
        staminaCost: attack.staminaCost,
        multiplier: attack.multiplier,
        scalingAttribute: attack.scalingAttribute,
        meetsRequirements: attack.meetsRequirements(player.level, effectiveAttributes.toValues()),
        revealsRandomMonsterAttribute: attack.revealsRandomMonsterAttribute,
      }));

    const isBossFight = step >= totalSteps;
    const monster = isBossFight
      ? await this.dungeonBossOfTheDayUseCase.getBossForTier(tier)
      : await this.pickScaledStepMonster(tier);

    const result = await beginDungeonFight({
      player,
      monster,
      dungeonTier: tier,
      isBossFight,
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
      return { ...result, availableAttacks };
    }

    if (isBossFight) {
      // The Growl always fires as the boss's reveal action (loot-system
      // follow-up) — breaks 0-50% of the player's remaining POTs, rounded
      // up, smallest stack first.
      const growlMessage = await this.applyGrowl(player.id);
      const combinedMessage = [result.message, growlMessage].filter(Boolean).join(" ");
      return {
        ...result,
        availableAttacks,
        message: combinedMessage.length > 0 ? combinedMessage : null,
      };
    }

    await this.playerRepository.update(
      Player.create({ ...player.toProps(), dungeonRunStep: step + 1 }),
    );
    return { ...result, availableAttacks };
  }

  private async pickScaledStepMonster(tier: 1 | 2 | 3): Promise<Monster> {
    const candidates = await this.monsterRepository.findAllExcludingMaterializedBosses();
    if (candidates.length === 0) throw new Error("No monsters available for the dungeon");
    const rawMonster = pick(candidates, this.rng);
    return scaleMonsterForDungeonStep(rawMonster, tier);
  }

  private async applyGrowl(playerId: string): Promise<string> {
    const breakPercent = rollGrowlBreakPercent(this.rng);

    const playerItems = await this.playerItemRepository.findByPlayerId(playerId);
    const items = await this.itemRepository.findByIds(playerItems.map((pi) => pi.itemId));
    const itemById = new Map(items.map((item) => [item.id, item]));

    const potStacks = playerItems
      .filter((pi) => POT_ITEM_NAMES.includes(itemById.get(pi.itemId)?.name ?? ""))
      .map((pi) => ({
        playerItemId: pi.id,
        itemName: itemById.get(pi.itemId)?.name ?? "",
        quantity: pi.quantity,
      }));

    const breaks = planGrowlPotBreak(potStacks, breakPercent);
    for (const brk of breaks) {
      if (brk.newQuantity === 0) {
        await this.playerItemRepository.delete(brk.playerItemId);
      } else {
        const existing = playerItems.find((pi) => pi.id === brk.playerItemId);
        if (existing) {
          await this.playerItemRepository.update(
            PlayerItem.create({ ...existing.toProps(), quantity: brk.newQuantity }),
          );
        }
      }
    }

    return breaks.length > 0
      ? "The boss lets out a terrifying Growl, shattering some of your potions!"
      : "The boss lets out a terrifying Growl!";
  }
}
