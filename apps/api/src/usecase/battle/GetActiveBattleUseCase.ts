import { maxHp, maxStamina } from "@/domain/battle/battleConfig";
import type { AttributeValues } from "@/domain/shared/Attributes";
import type { AttackRepository } from "@/usecase/attack/AttackRepository";
import type { BattleRepository } from "@/usecase/battle/BattleRepository";
import type {
  AvailableAttackOutput,
  BattleStatusOutput,
} from "@/usecase/battle/StartBattleUseCase";
import type { ItemRepository } from "@/usecase/item/ItemRepository";
import type { MonsterRepository } from "@/usecase/monster/MonsterRepository";
import { computeEffectiveAttributes } from "@/usecase/player/effectiveAttributes";
import type { PlayerItemRepository } from "@/usecase/player/PlayerItemRepository";
import type { PlayerRepository } from "@/usecase/player/PlayerRepository";

export interface GetActiveBattleInput {
  playerId: string;
}

export interface ActiveBattleMonsterOutput {
  id: string;
  name: string;
  description: string;
  monsterImage: string;
  hp: number;
  attributes: AttributeValues;
}

export interface ActiveBattleOutput {
  monster: ActiveBattleMonsterOutput;
  playerStatus: BattleStatusOutput;
  monsterStatus: BattleStatusOutput;
  availableAttacks: AvailableAttackOutput[];
}

/**
 * GET /battle — recovers a live battle's state after a page reload (plan3
 * §4b). Returns null (not a thrown error) when no battle is in progress.
 */
export class GetActiveBattleUseCase {
  constructor(
    private readonly battleRepository: BattleRepository,
    private readonly monsterRepository: MonsterRepository,
    private readonly playerRepository: PlayerRepository,
    private readonly playerItemRepository: PlayerItemRepository,
    private readonly itemRepository: ItemRepository,
    private readonly attackRepository: AttackRepository,
  ) {}

  async execute(input: GetActiveBattleInput): Promise<ActiveBattleOutput | null> {
    const battle = await this.battleRepository.findByPlayerId(input.playerId);
    if (!battle) return null;

    const player = await this.playerRepository.findById(input.playerId);
    if (!player) throw new Error("Player not found");

    const monster = await this.monsterRepository.findById(battle.monsterId);
    if (!monster) throw new Error("Monster not found");

    const effectiveAttributes = await computeEffectiveAttributes(
      player,
      this.playerItemRepository,
      this.itemRepository,
      battle.playerEffects,
    );
    const playerAttacks = await this.attackRepository.findAll();
    const availableAttacks: AvailableAttackOutput[] = playerAttacks.map((attack) => ({
      name: attack.name,
      staminaCost: attack.staminaCost,
      scalingAttribute: attack.scalingAttribute,
      meetsRequirements: attack.meetsRequirements(player.level, effectiveAttributes.toValues()),
    }));

    const playerMaxHp = maxHp(effectiveAttributes.vitality, effectiveAttributes.force);

    return {
      monster: {
        id: monster.id,
        name: monster.name,
        description: monster.description,
        monsterImage: monster.monsterImage,
        hp: monster.hp,
        attributes: monster.getAttributes().toValues(),
      },
      playerStatus: {
        currentHp: battle.playerCurrentHp,
        maxHp: playerMaxHp,
        currentStamina: battle.playerCurrentStamina,
        maxStamina: maxStamina(player.level),
      },
      monsterStatus: {
        currentHp: battle.monsterCurrentHp,
        maxHp: monster.hp,
        currentStamina: battle.monsterCurrentStamina,
        maxStamina: monster.maxStamina,
      },
      availableAttacks,
    };
  }
}
