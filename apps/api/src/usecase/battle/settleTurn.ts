import { Battle } from "@/domain/battle/Battle";
import type { BattleEffect } from "@/domain/battle/BattleEffect";
import { BATTLE_CONFIG, maxStamina } from "@/domain/battle/battleConfig";
import { rollGrowl } from "@/domain/dungeon/growlRoll";
import { decidePhaseTransition } from "@/domain/dungeon/phaseTransitionDecision";
import { applyXpGain } from "@/domain/level/LevelCurve";
import { rollDropPool } from "@/domain/monster/dropRoll";
import type { Monster } from "@/domain/monster/Monster";
import { Player } from "@/domain/player/Player";
import type { Rng } from "@/domain/shared/Rng";
import type { BattleRepository } from "@/usecase/battle/BattleRepository";
import { settlePlayerDeath } from "@/usecase/battle/deathSettlement";
import type { AttackResultOutput, TurnReportOutput } from "@/usecase/battle/TurnReportOutput";
import type { DungeonSlayerRankingRepository } from "@/usecase/dungeon/DungeonSlayerRankingRepository";
import type { ItemRepository } from "@/usecase/item/ItemRepository";
import type { LevelRepository } from "@/usecase/level/LevelRepository";
import type { MonsterRepository } from "@/usecase/monster/MonsterRepository";
import type { PlayerItemRepository } from "@/usecase/player/PlayerItemRepository";
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
  stunCooldownRoundsLeft: number;
  playerAttack: AttackResultOutput | null;
  monsterAttack: AttackResultOutput | null;
  messages: string[];
  playerMaxHp: number;
  rng: Rng;
  playerRepository: PlayerRepository;
  battleRepository: BattleRepository;
  levelRepository: LevelRepository;
  levelUpAttributePoints: number;
  monsterRepository: MonsterRepository;
  playerItemRepository: PlayerItemRepository;
  itemRepository: ItemRepository;
  dungeonSlayerRankingRepository: DungeonSlayerRankingRepository;
}

/** Rolls all three drop pools (the third, legendary_drops, is always empty
 * outside a materialized dungeon boss — plan3 §2c) and combines them into
 * one loot offer. */
function rollLootOffer(monster: Monster, rng: Rng): string[] {
  const dropItemId = rollDropPool(monster.drops, rng);
  const exclusiveDropItemId = rollDropPool(monster.exclusiveDrops, rng);
  const legendaryDropItemId = rollDropPool(monster.legendaryDrops, rng);
  return [dropItemId, exclusiveDropItemId, legendaryDropItemId].filter(
    (id): id is string => id !== null,
  );
}

/** The Growl (plan3 §2e): on success, destroys every POT stack (any
 * player_items row whose underlying item has hp_restore set) in the
 * player's bag. Bandages/antidotes (which cure effects, not restore HP) are
 * untouched. */
async function applyGrowlIfTriggered(
  playerId: string,
  rng: Rng,
  playerItemRepository: PlayerItemRepository,
  itemRepository: ItemRepository,
): Promise<boolean> {
  if (!rollGrowl(rng)) return false;

  const playerItems = await playerItemRepository.findByPlayerId(playerId);
  if (playerItems.length === 0) return true;

  const items = await itemRepository.findByIds(playerItems.map((pi) => pi.itemId));
  const itemById = new Map(items.map((item) => [item.id, item]));

  for (const playerItem of playerItems) {
    const item = itemById.get(playerItem.itemId);
    if (item?.hpRestore !== null && item?.hpRestore !== undefined) {
      await playerItemRepository.delete(playerItem.id);
    }
  }
  return true;
}

/**
 * Shared win/death/ongoing settlement + persistence + report building
 * (plan2 §5 steps 6-7), for turns where the player's own action never
 * damages the monster (Bag/Rest). DoT ticks can still kill either side.
 * Also owns the dungeon gatekeeper->boss phase transition (plan3 §2d): a
 * monster death with `battle.dungeonBossMonsterId` set is a *partial*
 * settlement (XP/loot awarded, the boss swapped in, the battle continues)
 * rather than the full win settlement below.
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
    stunCooldownRoundsLeft,
    playerAttack,
    monsterAttack,
    messages,
    playerMaxHp,
    rng,
    playerRepository,
    battleRepository,
    levelRepository,
    levelUpAttributePoints,
    monsterRepository,
    playerItemRepository,
    itemRepository,
    dungeonSlayerRankingRepository,
  } = params;

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

    const lootOffer = rollLootOffer(monster, rng);
    // pendingLoot accumulates (appends) rather than overwrites — a dungeon
    // run's gatekeeper-then-boss kills would otherwise silently discard the
    // first drop (plan3 §2d); safe for every ordinary battle too, since
    // pendingLoot is always empty going into a normal kill anyway.
    const updatedPlayer = Player.create({
      ...player.toProps(),
      xp: xpResult.xp,
      level: xpResult.level,
      attributePoints: player.attributePoints + xpResult.attributePointsGained,
      pendingLoot: [...player.pendingLoot, ...lootOffer],
    });
    await playerRepository.update(updatedPlayer);

    const transition = decidePhaseTransition(battle.dungeonBossMonsterId);

    if (transition.kind === "partialSettlement") {
      const bossMonster = await monsterRepository.findById(battle.dungeonBossMonsterId as string);
      if (!bossMonster) throw new Error("Dungeon boss monster not found");

      const transitionMessages = [
        `${monster.name} has fallen! You gained ${monster.xpGain} XP.`,
        `${bossMonster.name} reveals itself!`,
      ];

      let transitionMonsterAttack = monsterAttack;
      const growlTriggered = await applyGrowlIfTriggered(
        player.id,
        rng,
        playerItemRepository,
        itemRepository,
      );
      if (growlTriggered) {
        transitionMessages.push(
          `${bossMonster.name} lets out a terrifying Growl, destroying every potion in your bag!`,
        );
        transitionMonsterAttack = {
          attackName: "Growl",
          hit: true,
          damage: 0,
          effectApplied: null,
        };
      }

      const updatedBattle = Battle.create({
        ...battle.toProps(),
        monsterId: bossMonster.id,
        playerCurrentHp,
        playerCurrentStamina,
        monsterCurrentHp: bossMonster.hp,
        monsterCurrentStamina: bossMonster.maxStamina,
        round: battle.round + 1,
        playerEffects,
        monsterEffects: [],
        monsterChargingAttackId: null,
        chargeRoundsLeft: 0,
        monsterAttackWeights: {},
        stunCooldownRoundsLeft: 0,
        dungeonBossMonsterId: null,
      });
      await battleRepository.update(updatedBattle);

      return {
        playerAttack,
        monsterAttack: transitionMonsterAttack,
        messages: [...messages, ...transitionMessages],
        playerStatus: {
          currentHp: playerCurrentHp,
          maxHp: playerMaxHp,
          currentStamina: playerCurrentStamina,
          maxStamina: maxStamina(player.level),
        },
        monsterStatus: {
          currentHp: bossMonster.hp,
          maxHp: bossMonster.hp,
          currentStamina: bossMonster.maxStamina,
          maxStamina: bossMonster.maxStamina,
        },
        // Documented exception to "lootOffer only on a win" — the gatekeeper's
        // drops are real even though the run continues (plan3 §2d).
        outcome: "ongoing",
        lootOffer,
      };
    }

    // Full settlement — an ordinary kill, or the dungeon boss's own death.
    if (battle.dungeonTier === 3) {
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
        currentStamina: monsterCurrentStamina,
        maxStamina: monster.maxStamina,
      },
      outcome: "won",
      lootOffer,
    };
  }

  if (playerCurrentHp <= 0) {
    await settlePlayerDeath(player, levelRepository, playerRepository);
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
        currentStamina: monsterCurrentStamina,
        maxStamina: monster.maxStamina,
      },
      outcome: "lost",
      lootOffer: null,
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
    stunCooldownRoundsLeft,
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
      currentStamina: monsterCurrentStamina,
      maxStamina: monster.maxStamina,
    },
    outcome: "ongoing",
    lootOffer: null,
  };
}
