import { effectAppliedMessage, isStunned, toBattleEffectView } from "@/domain/battle/BattleEffect";
import { maxHp, maxStamina } from "@/domain/battle/battleConfig";
import { computeDamage } from "@/domain/battle/services/DamageCalculator";
import { rollEffectProc } from "@/domain/battle/services/EffectResolver";
import { buildRevealedAttributesView } from "@/domain/monster/monsterAttributeReveal";
import { Player } from "@/domain/player/Player";
import type { Rng } from "@/domain/shared/Rng";
import type { BattleRepository } from "@/usecase/battle/BattleRepository";
import { defaultMonsterAttack } from "@/usecase/battle/combatStance";
import { settlePlayerDeath } from "@/usecase/battle/deathSettlement";
import type { EffectCounterRepository } from "@/usecase/battle/EffectCounterRepository";
import { NoActiveBattleError } from "@/usecase/battle/errors";
import { resolveStunnedTurn } from "@/usecase/battle/resolveStunnedTurn";
import type { TurnReportOutput } from "@/usecase/battle/TurnReportOutput";
import type { DungeonSlayerRankingRepository } from "@/usecase/dungeon/DungeonSlayerRankingRepository";
import type { ItemRepository } from "@/usecase/item/ItemRepository";
import type { UniqueItemOwnershipRepository } from "@/usecase/item/UniqueItemOwnershipRepository";
import type { LevelRepository } from "@/usecase/level/LevelRepository";
import type { MonsterCatalogCache } from "@/usecase/monster/MonsterCatalogCache";
import { computeEffectiveAttributesWithDebuff } from "@/usecase/player/effectiveAttributes";
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
    private readonly monsterCatalogCache: MonsterCatalogCache,
    private readonly levelRepository: LevelRepository,
    private readonly rng: Rng,
    private readonly levelUpAttributePoints: number,
    private readonly statusCooldownRounds: number,
    private readonly dungeonSlayerRankingRepository: DungeonSlayerRankingRepository,
    private readonly effectCounterRepository: EffectCounterRepository,
    private readonly uniqueItemOwnershipRepository: UniqueItemOwnershipRepository,
    private readonly setAttributeBonus: number,
  ) {}

  async execute(input: RunFromBattleInput): Promise<TurnReportOutput> {
    const battle = await this.battleRepository.findByPlayerId(input.playerId);
    if (!battle) throw new NoActiveBattleError();

    const player = await this.playerRepository.findById(input.playerId);
    if (!player) throw new Error("Player not found");

    const [monsterWithMoveset, { base: attributesBeforeDebuff, effective: effectiveAttributes }] =
      await Promise.all([
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

    // Stunned: the flee attempt itself is voided too — the monster gets a
    // full normal turn instead of just a parting-hit chance.
    if (isStunned(battle.playerEffects)) {
      return resolveStunnedTurn({
        battle,
        player,
        monster,
        moveset,
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

    const monsterAttributes = monster.getAttributes();
    const monsterAttributesView = buildRevealedAttributesView(
      monsterAttributes.toValues(),
      battle.revealedMonsterAttributes,
    );

    let playerCurrentHp = battle.playerCurrentHp;
    let monsterAttack: TurnReportOutput["monsterAttack"] = null;
    let partingHitMessage: string | null = null;

    if (monsterAttributes.agility > effectiveAttributes.agility) {
      const attack = defaultMonsterAttack(moveset);
      const damage = computeDamage({
        attackMultiplier: attack.multiplier,
        attackerScalingValue: monsterAttributes.get(attack.scalingAttribute),
        staminaCost: attack.staminaCost,
        defenderLevel: player.level,
        defenderScalingValue: effectiveAttributes.get(attack.scalingAttribute),
      });
      playerCurrentHp = Math.max(0, playerCurrentHp - damage);

      // Normal combat math includes the effect proc roll (plan2 §5b step 1),
      // same as any other monster hit — the battle row is deleted right
      // after this either way, so there's nothing to persist the resulting
      // BattleEffect onto, but the turn report should still reflect whether
      // one landed.
      let effectApplied: string | null = null;
      const proced = rollEffectProc(
        { attackerLuck: monsterAttributes.luck, defenderLuck: effectiveAttributes.luck },
        this.rng,
      );
      if (proced) {
        const kind = attack.appliesEffect ?? monster.innateEffectKind;
        effectApplied = kind;
        partingHitMessage = effectAppliedMessage(kind);
      }
      monsterAttack = { attackName: attack.name, hit: true, damage, effectApplied };
    }

    await this.battleRepository.deleteByPlayerId(player.id);

    if (playerCurrentHp <= 0) {
      await settlePlayerDeath(player, this.levelRepository, this.playerRepository);
      if (battle.dungeonTier !== null) {
        // Dying to the parting hit mid-fight during a dungeon run ends it
        // outright, same as a boss kill or an entrance ambush death.
        await this.playerRepository.update(
          Player.create({
            ...player.toProps(),
            dungeonRunTier: null,
            dungeonRunStep: null,
            dungeonRunTotalSteps: null,
          }),
        );
      }
      return {
        playerAttack: null,
        monsterAttack,
        messages: partingHitMessage ? [partingHitMessage] : [],
        playerStatus: {
          currentHp: 0,
          maxHp: playerMaxHp,
          currentStamina: battle.playerCurrentStamina,
          maxStamina: maxStamina(player.level),
        },
        monsterStatus: {
          currentHp: battle.monsterCurrentHp,
          maxHp: monster.hp,
        },
        monsterAttributes: monsterAttributesView,
        outcome: "lost",
        lootOffer: null,
        playerEffects: battle.playerEffects.map(toBattleEffectView),
        monsterEffects: battle.monsterEffects.map(toBattleEffectView),
        attributesBeforeDebuff: attributesBeforeDebuff.toValues(),
        attributesAfterDebuff: effectiveAttributes.toValues(),
        // A flee never ticks effects — the battle ends this same turn
        // either way (fled or dead), so there's no DoT-tick step here.
        playerEffectDamage: 0,
        monsterEffectDamage: 0,
        dungeonRunEnded: false,
      };
    }

    // Fleeing mid-fight during a dungeon run ends it outright too — same
    // as dying does, per the user's explicit "if the player RUN or DIES
    // the dungeon is counted as ended" intent, not just death.
    const updatedPlayer = Player.create({
      ...player.toProps(),
      lastRunAt: new Date(),
      ...(battle.dungeonTier !== null
        ? { dungeonRunTier: null, dungeonRunStep: null, dungeonRunTotalSteps: null }
        : {}),
    });
    await this.playerRepository.update(updatedPlayer);

    return {
      playerAttack: null,
      monsterAttack,
      messages: partingHitMessage ? [partingHitMessage] : [],
      playerStatus: {
        currentHp: playerCurrentHp,
        maxHp: playerMaxHp,
        currentStamina: battle.playerCurrentStamina,
        maxStamina: maxStamina(player.level),
      },
      monsterStatus: {
        currentHp: battle.monsterCurrentHp,
        maxHp: monster.hp,
      },
      monsterAttributes: monsterAttributesView,
      outcome: "fled",
      lootOffer: null,
      playerEffects: battle.playerEffects.map(toBattleEffectView),
      monsterEffects: battle.monsterEffects.map(toBattleEffectView),
      attributesBeforeDebuff: attributesBeforeDebuff.toValues(),
      attributesAfterDebuff: effectiveAttributes.toValues(),
      playerEffectDamage: 0,
      monsterEffectDamage: 0,
      dungeonRunEnded: false,
    };
  }
}
