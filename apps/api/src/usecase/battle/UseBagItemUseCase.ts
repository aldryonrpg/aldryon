import {
  isDot,
  isStunned,
  removeDotByCounterItem,
  tickEffects,
} from "@/domain/battle/BattleEffect";
import { maxHp } from "@/domain/battle/battleConfig";
import { PlayerItem } from "@/domain/player/PlayerItem";
import { ATTRIBUTE_KEYS } from "@/domain/shared/Attributes";
import type { Rng } from "@/domain/shared/Rng";
import type { AttackRepository } from "@/usecase/attack/AttackRepository";
import type { BattleRepository } from "@/usecase/battle/BattleRepository";
import type { EffectCounterRepository } from "@/usecase/battle/EffectCounterRepository";
import { InvalidBagItemError, NoActiveBattleError } from "@/usecase/battle/errors";
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

export interface UseBagItemInput {
  playerId: string;
  playerItemId: string;
}

/** Use a consumable from the bag — POTs, Bandage, Antidote (plan2 §5c). */
export class UseBagItemUseCase {
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

  async execute(input: UseBagItemInput): Promise<TurnReportOutput> {
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
        playerAttacks,
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

    const playerItem = await this.playerItemRepository.findById(input.playerItemId);
    if (!playerItem || playerItem.playerId !== player.id) {
      throw new InvalidBagItemError("Item not found in your bag");
    }
    if (playerItem.isEquipped) {
      throw new InvalidBagItemError("Cannot use an equipped item");
    }

    const item = await this.itemRepository.findById(playerItem.itemId);
    if (!item) throw new Error("Item not found in catalog");

    let playerCurrentHp = battle.playerCurrentHp;
    let playerEffects = battle.playerEffects;
    let revealedMonsterAttributes = battle.revealedMonsterAttributes;
    const messages: string[] = [];

    if (item.hpRestore !== null) {
      playerCurrentHp = Math.min(playerMaxHp, playerCurrentHp + item.hpRestore);
    } else if (playerEffects.some((effect) => isDot(effect) && effect.counterItemId === item.id)) {
      // Cures every stacked instance of the matching DoT kind in one use —
      // bleed/poison can stack unlimited via repeated procs, but one
      // bandage/antidote clears all of them at once (see BattleEffect.ts).
      playerEffects = removeDotByCounterItem(playerEffects, item.id);
    } else if (item.revealsAllMonsterAttributes) {
      revealedMonsterAttributes = [...ATTRIBUTE_KEYS];
      messages.push("The Knowledge Potion lays bare every one of the monster's attributes!");
    } else {
      throw new InvalidBagItemError("This item has no consumable use");
    }

    if (playerItem.quantity > 1) {
      await this.playerItemRepository.update(
        PlayerItem.create({ ...playerItem.toProps(), quantity: playerItem.quantity - 1 }),
      );
    } else {
      await this.playerItemRepository.delete(playerItem.id);
    }

    const monsterTurn = await resolveMonsterTurn({
      state: {
        playerCurrentHp,
        monsterCurrentStamina: battle.monsterCurrentStamina,
        playerEffects,
        monsterChargingAttackId: battle.monsterChargingAttackId,
        chargeRoundsLeft: battle.chargeRoundsLeft,
        monsterAttackWeights: battle.monsterAttackWeights,
        statusCooldownRoundsLeft: battle.statusCooldownRoundsLeft,
      },
      monster,
      moveset,
      playerAttacks,
      playerLevel: player.level,
      effectiveAttributes,
      rng: this.rng,
      effectCounterRepository: this.effectCounterRepository,
      statusCooldownRounds: this.statusCooldownRounds,
    });
    messages.push(...monsterTurn.messages);

    const playerTick = tickEffects(monsterTurn.playerEffects);
    const monsterTick = tickEffects(battle.monsterEffects);
    const finalPlayerHp = Math.max(0, monsterTurn.playerCurrentHp - playerTick.totalDamage);
    const finalMonsterHp = Math.max(0, battle.monsterCurrentHp - monsterTick.totalDamage);

    return settleTurn({
      battle,
      player,
      monster,
      playerCurrentHp: finalPlayerHp,
      playerCurrentStamina: battle.playerCurrentStamina,
      monsterCurrentHp: finalMonsterHp,
      monsterCurrentStamina: monsterTurn.monsterCurrentStamina,
      playerEffects: playerTick.remaining,
      monsterEffects: monsterTick.remaining,
      monsterChargingAttackId: monsterTurn.monsterChargingAttackId,
      chargeRoundsLeft: monsterTurn.chargeRoundsLeft,
      monsterAttackWeights: monsterTurn.monsterAttackWeights,
      statusCooldownRoundsLeft: monsterTurn.statusCooldownRoundsLeft,
      playerAttack: null,
      monsterAttack: monsterTurn.monsterAttack,
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
