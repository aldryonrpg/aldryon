import { Battle } from "@/domain/battle/Battle";
import type { BattleEffect } from "@/domain/battle/BattleEffect";
import { applyStatDebuffs, toBattleEffectView } from "@/domain/battle/BattleEffect";
import { BATTLE_CONFIG, maxStamina } from "@/domain/battle/battleConfig";
import { applyXpGain } from "@/domain/level/LevelCurve";
import { rollDropPool } from "@/domain/monster/dropRoll";
import type { Monster } from "@/domain/monster/Monster";
import { buildRevealedAttributesView } from "@/domain/monster/monsterAttributeReveal";
import { Player } from "@/domain/player/Player";
import type { AttributeKey, Attributes } from "@/domain/shared/Attributes";
import type { Rng } from "@/domain/shared/Rng";
import type { BattleRepository } from "@/usecase/battle/BattleRepository";
import { settlePlayerDeath } from "@/usecase/battle/deathSettlement";
import { resolveLegendaryDrop } from "@/usecase/battle/resolveLegendaryDrop";
import type { AttackResultOutput, TurnReportOutput } from "@/usecase/battle/TurnReportOutput";
import type { DungeonSlayerRankingRepository } from "@/usecase/dungeon/DungeonSlayerRankingRepository";
import type { ItemRepository } from "@/usecase/item/ItemRepository";
import type { UniqueItemOwnershipRepository } from "@/usecase/item/UniqueItemOwnershipRepository";
import type { LevelRepository } from "@/usecase/level/LevelRepository";
import type { PlayerRepository } from "@/usecase/player/PlayerRepository";

export interface SettleTurnParams {
  battle: Battle;
  player: Player;
  monster: Monster;
  playerCurrentHp: number;
  playerCurrentStamina: number;
  monsterCurrentHp: number;
  monsterCurrentStamina: number;
  playerEffects: BattleEffect[];
  monsterEffects: BattleEffect[];
  monsterChargingAttackId: string | null;
  chargeRoundsLeft: number;
  monsterAttackWeights: Record<string, number>;
  statusCooldownRoundsLeft: number;
  playerAttack: AttackResultOutput | null;
  monsterAttack: AttackResultOutput | null;
  messages: string[];
  playerMaxHp: number;
  /** Item/set-bonus attributes before any stat-decay debuff — doesn't
   * change mid-turn (equipment can't change during a battle), so callers
   * compute it once up front; settleTurn re-derives the after-debuff value
   * from the turn's final `playerEffects` (a pure function, no extra I/O). */
  attributesBeforeDebuff: Attributes;
  /** Omit to carry `battle.revealedMonsterAttributes` forward unchanged —
   * only AttackUseCase (REVEAL SPELL) and UseBagItemUseCase (Knowledge
   * Potion) ever pass a grown set. */
  revealedMonsterAttributes?: AttributeKey[];
  /** This turn's combined bleed/poison/burn tick damage — callers already
   * computed these via tickEffects() to adjust playerCurrentHp/
   * monsterCurrentHp before calling in; passed through so the report can
   * surface them instead of them disappearing into the HP delta. */
  playerEffectDamage: number;
  monsterEffectDamage: number;
  rng: Rng;
  playerRepository: PlayerRepository;
  battleRepository: BattleRepository;
  levelRepository: LevelRepository;
  levelUpAttributePoints: number;
  dungeonSlayerRankingRepository: DungeonSlayerRankingRepository;
  itemRepository: ItemRepository;
  uniqueItemOwnershipRepository: UniqueItemOwnershipRepository;
}

/** Rolls all three drop pools and combines them into one loot offer. The
 * third, legendary_drops, is always empty outside a materialized dungeon
 * boss (plan3 §2c) and uses its own per-mille roll + unique-item ownership
 * guard (loot-system follow-up) — see resolveLegendaryDrop. */
async function rollLootOffer(
  monster: Monster,
  playerId: string,
  rng: Rng,
  itemRepository: ItemRepository,
  uniqueItemOwnershipRepository: UniqueItemOwnershipRepository,
): Promise<string[]> {
  const dropItemId = rollDropPool(monster.drops, rng);
  const exclusiveDropItemId = rollDropPool(monster.exclusiveDrops, rng);
  const legendaryDropItemId = await resolveLegendaryDrop(
    monster.legendaryDrops,
    playerId,
    rng,
    itemRepository,
    uniqueItemOwnershipRepository,
  );
  return [dropItemId, exclusiveDropItemId, legendaryDropItemId].filter(
    (id): id is string => id !== null,
  );
}

/**
 * Shared win/death/ongoing settlement + persistence + report building
 * (plan2 §5 steps 6-7), for turns where the player's own action never
 * damages the monster (Bag/Rest). DoT ticks can still kill either side.
 * Every kill (wild or dungeon — step or boss) fully settles and deletes the
 * battle row the same way (loot-system follow-up removed the old mid-battle
 * gatekeeper->boss phase transition — a dungeon run now advances one fresh
 * fight at a time via /dungeon/continue, not by swapping the monster inside
 * a still-live battle).
 */
export async function settleTurn(params: SettleTurnParams): Promise<TurnReportOutput> {
  const {
    battle,
    player,
    monster,
    playerCurrentHp,
    playerCurrentStamina,
    monsterCurrentHp,
    monsterCurrentStamina,
    playerEffects,
    monsterEffects,
    monsterChargingAttackId,
    chargeRoundsLeft,
    monsterAttackWeights,
    statusCooldownRoundsLeft,
    playerAttack,
    monsterAttack,
    messages,
    playerMaxHp,
    attributesBeforeDebuff,
    playerEffectDamage,
    monsterEffectDamage,
    rng,
    playerRepository,
    battleRepository,
    levelRepository,
    levelUpAttributePoints,
    dungeonSlayerRankingRepository,
    itemRepository,
    uniqueItemOwnershipRepository,
  } = params;

  const attributesAfterDebuff = applyStatDebuffs(attributesBeforeDebuff, playerEffects);
  const playerEffectsView = playerEffects.map(toBattleEffectView);
  const monsterEffectsView = monsterEffects.map(toBattleEffectView);

  const revealedMonsterAttributes =
    params.revealedMonsterAttributes ?? battle.revealedMonsterAttributes;
  const monsterAttributesView = buildRevealedAttributesView(
    monster.getAttributes().toValues(),
    revealedMonsterAttributes,
  );

  if (monsterCurrentHp <= 0) {
    const levels = await levelRepository.findAll();
    const xpResult = applyXpGain({
      levels,
      currentXp: player.xp,
      currentLevel: player.level,
      xpGain: monster.xpGain,
      maxXp: BATTLE_CONFIG.maxXp,
      attributePointsPerLevel: levelUpAttributePoints,
    });

    const lootOffer = await rollLootOffer(
      monster,
      player.id,
      rng,
      itemRepository,
      uniqueItemOwnershipRepository,
    );
    const updatedPlayer = Player.create({
      ...player.toProps(),
      xp: xpResult.xp,
      level: xpResult.level,
      attributePoints: player.attributePoints + xpResult.attributePointsGained,
      pendingLoot: [...player.pendingLoot, ...lootOffer],
      // Killing the boss (any tier) ends the run outright — without this,
      // dungeonRunStep stays equal to dungeonRunTotalSteps forever, so the
      // next /dungeon/continue re-derives isBossFight as true again and
      // fights the same materialized boss row a second time. A regular
      // step kill leaves these untouched; ContinueDungeonUseCase still
      // needs them to know what's next.
      ...(battle.dungeonIsBossFight
        ? { dungeonRunTier: null, dungeonRunStep: null, dungeonRunTotalSteps: null }
        : {}),
    });
    await playerRepository.update(updatedPlayer);

    // Only an actual boss kill at tier 3 counts toward Dungeon Slayer
    // standing — never a step kill, at any tier (plan3 §2g, loot-system
    // follow-up: dungeonIsBossFight is the discriminator now that every
    // kill fully settles).
    if (battle.dungeonTier === 3 && battle.dungeonIsBossFight) {
      await dungeonSlayerRankingRepository.incrementKill(player.id, new Date());
    }
    await battleRepository.deleteByPlayerId(player.id);

    return {
      playerAttack,
      monsterAttack,
      messages,
      playerStatus: {
        currentHp: playerCurrentHp,
        maxHp: playerMaxHp,
        currentStamina: playerCurrentStamina,
        maxStamina: maxStamina(player.level),
      },
      monsterStatus: {
        currentHp: 0,
        maxHp: monster.hp,
      },
      monsterAttributes: monsterAttributesView,
      outcome: "won",
      lootOffer,
      playerEffects: playerEffectsView,
      monsterEffects: monsterEffectsView,
      attributesBeforeDebuff: attributesBeforeDebuff.toValues(),
      attributesAfterDebuff: attributesAfterDebuff.toValues(),
      playerEffectDamage,
      monsterEffectDamage,
      dungeonRunEnded: battle.dungeonIsBossFight,
    };
  }

  if (playerCurrentHp <= 0) {
    await settlePlayerDeath(player, levelRepository, playerRepository);
    if (battle.dungeonTier !== null) {
      // Dying mid-fight during a dungeon run ends it outright, same as a
      // boss kill or an entrance ambush death — cleared here so it never
      // dangles waiting on the player to click Exit.
      await playerRepository.update(
        Player.create({
          ...player.toProps(),
          dungeonRunTier: null,
          dungeonRunStep: null,
          dungeonRunTotalSteps: null,
        }),
      );
    }
    await battleRepository.deleteByPlayerId(player.id);

    return {
      playerAttack,
      monsterAttack,
      messages,
      playerStatus: {
        currentHp: 0,
        maxHp: playerMaxHp,
        currentStamina: playerCurrentStamina,
        maxStamina: maxStamina(player.level),
      },
      monsterStatus: {
        currentHp: monsterCurrentHp,
        maxHp: monster.hp,
      },
      monsterAttributes: monsterAttributesView,
      outcome: "lost",
      lootOffer: null,
      playerEffects: playerEffectsView,
      monsterEffects: monsterEffectsView,
      attributesBeforeDebuff: attributesBeforeDebuff.toValues(),
      attributesAfterDebuff: attributesAfterDebuff.toValues(),
      playerEffectDamage,
      monsterEffectDamage,
      dungeonRunEnded: false,
    };
  }

  const updatedBattle = Battle.create({
    ...battle.toProps(),
    playerCurrentHp,
    playerCurrentStamina,
    monsterCurrentHp,
    monsterCurrentStamina,
    round: battle.round + 1,
    playerEffects,
    monsterEffects,
    monsterChargingAttackId,
    chargeRoundsLeft,
    monsterAttackWeights,
    statusCooldownRoundsLeft,
    revealedMonsterAttributes,
  });
  await battleRepository.update(updatedBattle);

  return {
    playerAttack,
    monsterAttack,
    messages,
    playerStatus: {
      currentHp: playerCurrentHp,
      maxHp: playerMaxHp,
      currentStamina: playerCurrentStamina,
      maxStamina: maxStamina(player.level),
    },
    monsterStatus: {
      currentHp: monsterCurrentHp,
      maxHp: monster.hp,
    },
    monsterAttributes: monsterAttributesView,
    outcome: "ongoing",
    lootOffer: null,
    playerEffects: playerEffectsView,
    monsterEffects: monsterEffectsView,
    attributesBeforeDebuff: attributesBeforeDebuff.toValues(),
    attributesAfterDebuff: attributesAfterDebuff.toValues(),
    playerEffectDamage,
    monsterEffectDamage,
    dungeonRunEnded: false,
  };
}
