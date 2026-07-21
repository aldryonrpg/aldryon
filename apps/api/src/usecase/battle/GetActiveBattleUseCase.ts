import type { BattleEffectView } from "@/domain/battle/BattleEffect";
import { toBattleEffectView } from "@/domain/battle/BattleEffect";
import { maxHp, maxStamina } from "@/domain/battle/battleConfig";
import { buildRevealedAttributesView } from "@/domain/monster/monsterAttributeReveal";
import { ATTRIBUTE_KEYS, type AttributeValues } from "@/domain/shared/Attributes";
import type { AttackRepository } from "@/usecase/attack/AttackRepository";
import type { BattleRepository } from "@/usecase/battle/BattleRepository";
import { resolveBattleMonster } from "@/usecase/battle/resolveBattleMonster";
import type {
  AvailableAttackOutput,
  BattleStatusOutput,
  MonsterStatusOutput,
} from "@/usecase/battle/StartBattleUseCase";
import type { ItemRepository } from "@/usecase/item/ItemRepository";
import type { MonsterCatalogCache } from "@/usecase/monster/MonsterCatalogCache";
import { computeEffectiveAttributesWithDebuff } from "@/usecase/player/effectiveAttributes";
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
  attributes: Partial<AttributeValues>;
}

export interface ActiveBattleOutput {
  monster: ActiveBattleMonsterOutput;
  playerStatus: BattleStatusOutput;
  monsterStatus: MonsterStatusOutput;
  availableAttacks: AvailableAttackOutput[];
  playerEffects: BattleEffectView[];
  monsterEffects: BattleEffectView[];
  attributesBeforeDebuff: AttributeValues;
  attributesAfterDebuff: AttributeValues;
}

/**
 * GET /battle — recovers a live battle's state after a page reload (plan3
 * §4b). Returns null (not a thrown error) when no battle is in progress.
 */
export class GetActiveBattleUseCase {
  constructor(
    private readonly battleRepository: BattleRepository,
    private readonly monsterCatalogCache: MonsterCatalogCache,
    private readonly playerRepository: PlayerRepository,
    private readonly playerItemRepository: PlayerItemRepository,
    private readonly itemRepository: ItemRepository,
    private readonly attackRepository: AttackRepository,
    private readonly setAttributeBonus: number,
  ) {}

  async execute(input: GetActiveBattleInput): Promise<ActiveBattleOutput | null> {
    const battle = await this.battleRepository.findByPlayerId(input.playerId);
    if (!battle) return null;

    const player = await this.playerRepository.findById(input.playerId);
    if (!player) throw new Error("Player not found");

    const rawMonster = await this.monsterCatalogCache.getMonster(battle.monsterId);
    if (!rawMonster) throw new Error("Monster not found");
    const monster = resolveBattleMonster(rawMonster, battle);

    const { base: attributesBeforeDebuff, effective: effectiveAttributes } =
      await computeEffectiveAttributesWithDebuff(
        player,
        this.playerItemRepository,
        this.itemRepository,
        this.setAttributeBonus,
        battle.playerEffects,
      );
    const playerAttacks = await this.attackRepository.findAll();
    const allAttributesRevealed = battle.revealedMonsterAttributes.length >= ATTRIBUTE_KEYS.length;
    // Attacks the player hasn't unlocked (level/base attribute requirements
    // not met — a debuff never revokes an unlock, only meetsRequirements
    // below reacts to that) never leave the API.
    const availableAttacks: AvailableAttackOutput[] = playerAttacks
      .filter((attack) => attack.meetsRequirements(player.level, attributesBeforeDebuff.toValues()))
      .map((attack) => ({
        name: attack.name,
        staminaCost: attack.staminaCost,
        multiplier: attack.multiplier,
        scalingAttribute: attack.scalingAttribute,
        meetsRequirements:
          attack.meetsRequirements(player.level, effectiveAttributes.toValues()) &&
          !(attack.revealsRandomMonsterAttribute && allAttributesRevealed),
        revealsRandomMonsterAttribute: attack.revealsRandomMonsterAttribute,
      }));

    const playerMaxHp = maxHp(effectiveAttributes.vitality, effectiveAttributes.strength);

    return {
      monster: {
        id: monster.id,
        name: monster.name,
        description: monster.description,
        monsterImage: monster.monsterImage,
        hp: monster.hp,
        attributes: buildRevealedAttributesView(
          monster.getAttributes().toValues(),
          battle.revealedMonsterAttributes,
        ),
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
      },
      availableAttacks,
      playerEffects: battle.playerEffects.map(toBattleEffectView),
      monsterEffects: battle.monsterEffects.map(toBattleEffectView),
      attributesBeforeDebuff: attributesBeforeDebuff.toValues(),
      attributesAfterDebuff: effectiveAttributes.toValues(),
    };
  }
}
