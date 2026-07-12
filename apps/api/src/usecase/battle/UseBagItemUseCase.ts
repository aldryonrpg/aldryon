import { isDot, tickEffects } from "@/domain/battle/BattleEffect";
import { maxHp } from "@/domain/battle/battleConfig";
import { PlayerItem } from "@/domain/player/PlayerItem";
import type { Rng } from "@/domain/shared/Rng";
import type { AttackRepository } from "@/usecase/attack/AttackRepository";
import type { BattleRepository } from "@/usecase/battle/BattleRepository";
import { InvalidBagItemError, NoActiveBattleError } from "@/usecase/battle/errors";
import { resolveMonsterTurn } from "@/usecase/battle/resolveMonsterTurn";
import { settleTurn } from "@/usecase/battle/settleTurn";
import type { TurnReportOutput } from "@/usecase/battle/TurnReportOutput";
import type { ItemRepository } from "@/usecase/item/ItemRepository";
import type { LevelRepository } from "@/usecase/level/LevelRepository";
import type { MonsterAttackRepository } from "@/usecase/monster/MonsterAttackRepository";
import type { MonsterRepository } from "@/usecase/monster/MonsterRepository";
import { computeEffectiveAttributes } from "@/usecase/player/effectiveAttributes";
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
    private readonly monsterRepository: MonsterRepository,
    private readonly monsterAttackRepository: MonsterAttackRepository,
    private readonly attackRepository: AttackRepository,
    private readonly levelRepository: LevelRepository,
    private readonly rng: Rng,
    private readonly levelUpAttributePoints: number,
  ) {}

  async execute(input: UseBagItemInput): Promise<TurnReportOutput> {
    const battle = await this.battleRepository.findByPlayerId(input.playerId);
    if (!battle) throw new NoActiveBattleError();

    const player = await this.playerRepository.findById(input.playerId);
    if (!player) throw new Error("Player not found");

    const playerItem = await this.playerItemRepository.findById(input.playerItemId);
    if (!playerItem || playerItem.playerId !== player.id) {
      throw new InvalidBagItemError("Item not found in your bag");
    }
    if (playerItem.isEquipped) {
      throw new InvalidBagItemError("Cannot use an equipped item");
    }

    const item = await this.itemRepository.findById(playerItem.itemId);
    if (!item) throw new Error("Item not found in catalog");

    const monster = await this.monsterRepository.findById(battle.monsterId);
    if (!monster) throw new Error("Monster not found");

    const [playerAttacks, moveset, effectiveAttributes] = await Promise.all([
      this.attackRepository.findAll(),
      this.monsterAttackRepository.findMovesetByMonsterId(monster.id),
      computeEffectiveAttributes(player, this.playerItemRepository, this.itemRepository),
    ]);

    const playerMaxHp = maxHp(effectiveAttributes.vitality, effectiveAttributes.force);
    let playerCurrentHp = battle.playerCurrentHp;
    let playerEffects = battle.playerEffects;

    if (item.hpRestore !== null) {
      playerCurrentHp = Math.min(playerMaxHp, playerCurrentHp + item.hpRestore);
    } else if (playerEffects.some((effect) => isDot(effect) && effect.counterItemId === item.id)) {
      playerEffects = playerEffects.filter(
        (effect) => !(isDot(effect) && effect.counterItemId === item.id),
      );
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
      },
      monster,
      moveset,
      playerAttacks,
      playerLevel: player.level,
      effectiveAttributes,
      rng: this.rng,
      itemRepository: this.itemRepository,
    });

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
      playerAttack: null,
      monsterAttack: monsterTurn.monsterAttack,
      messages: monsterTurn.messages,
      playerMaxHp,
      rng: this.rng,
      playerRepository: this.playerRepository,
      battleRepository: this.battleRepository,
      levelRepository: this.levelRepository,
      levelUpAttributePoints: this.levelUpAttributePoints,
    });
  }
}
