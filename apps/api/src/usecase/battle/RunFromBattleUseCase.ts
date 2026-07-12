import { maxHp, maxStamina } from "@/domain/battle/battleConfig";
import { computeDamage } from "@/domain/battle/services/DamageCalculator";
import { Player } from "@/domain/player/Player";
import type { AttackRepository } from "@/usecase/attack/AttackRepository";
import type { BattleRepository } from "@/usecase/battle/BattleRepository";
import { defaultMonsterAttack, defaultPlayerAttack } from "@/usecase/battle/combatStance";
import { settlePlayerDeath } from "@/usecase/battle/deathSettlement";
import { NoActiveBattleError } from "@/usecase/battle/errors";
import type { TurnReportOutput } from "@/usecase/battle/TurnReportOutput";
import type { ItemRepository } from "@/usecase/item/ItemRepository";
import type { LevelRepository } from "@/usecase/level/LevelRepository";
import type { MonsterAttackRepository } from "@/usecase/monster/MonsterAttackRepository";
import type { MonsterRepository } from "@/usecase/monster/MonsterRepository";
import { computeEffectiveAttributes } from "@/usecase/player/effectiveAttributes";
import type { PlayerItemRepository } from "@/usecase/player/PlayerItemRepository";
import type { PlayerRepository } from "@/usecase/player/PlayerRepository";

export interface RunFromBattleInput {
  playerId: string;
}

/**
 * Try to flee (plan2 §5b) — a straight Agility comparison, no roll: if the
 * monster's Agility is greater than the player's effective Agility, it
 * lands one free parting strike as the player turns their back.
 */
export class RunFromBattleUseCase {
  constructor(
    private readonly playerRepository: PlayerRepository,
    private readonly playerItemRepository: PlayerItemRepository,
    private readonly itemRepository: ItemRepository,
    private readonly battleRepository: BattleRepository,
    private readonly monsterRepository: MonsterRepository,
    private readonly monsterAttackRepository: MonsterAttackRepository,
    private readonly attackRepository: AttackRepository,
    private readonly levelRepository: LevelRepository,
  ) {}

  async execute(input: RunFromBattleInput): Promise<TurnReportOutput> {
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

    const playerMaxHp = maxHp(effectiveAttributes.vitality, effectiveAttributes.force);
    const monsterAttributes = monster.getAttributes();

    let playerCurrentHp = battle.playerCurrentHp;
    let monsterAttack: TurnReportOutput["monsterAttack"] = null;

    if (monsterAttributes.agility > effectiveAttributes.agility) {
      const attack = defaultMonsterAttack(moveset);
      const playerStance = defaultPlayerAttack(playerAttacks);
      const damage = computeDamage({
        attackMultiplier: attack.multiplier,
        attackerScalingValue: monsterAttributes.get(attack.scalingAttribute),
        staminaCost: attack.staminaCost,
        defenderLevel: player.level,
        defenderScalingValue: effectiveAttributes.get(playerStance.scalingAttribute),
      });
      playerCurrentHp = Math.max(0, playerCurrentHp - damage);
      monsterAttack = { attackName: attack.name, hit: true, damage, effectApplied: null };
    }

    await this.battleRepository.deleteByPlayerId(player.id);

    if (playerCurrentHp <= 0) {
      await settlePlayerDeath(player, this.levelRepository, this.playerRepository);
      return {
        playerAttack: null,
        monsterAttack,
        messages: [],
        playerStatus: {
          currentHp: 0,
          maxHp: playerMaxHp,
          currentStamina: battle.playerCurrentStamina,
          maxStamina: maxStamina(player.level),
        },
        monsterStatus: {
          currentHp: battle.monsterCurrentHp,
          maxHp: monster.hp,
          currentStamina: battle.monsterCurrentStamina,
          maxStamina: maxStamina(monster.level),
        },
        outcome: "lost",
        lootOffer: null,
      };
    }

    const updatedPlayer = Player.create({ ...player.toProps(), lastRunAt: new Date() });
    await this.playerRepository.update(updatedPlayer);

    return {
      playerAttack: null,
      monsterAttack,
      messages: [],
      playerStatus: {
        currentHp: playerCurrentHp,
        maxHp: playerMaxHp,
        currentStamina: battle.playerCurrentStamina,
        maxStamina: maxStamina(player.level),
      },
      monsterStatus: {
        currentHp: battle.monsterCurrentHp,
        maxHp: monster.hp,
        currentStamina: battle.monsterCurrentStamina,
        maxStamina: maxStamina(monster.level),
      },
      outcome: "fled",
      lootOffer: null,
    };
  }
}
