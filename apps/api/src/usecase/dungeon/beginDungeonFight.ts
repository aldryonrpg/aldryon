import { Battle } from "@/domain/battle/Battle";
import type { BattleEffect } from "@/domain/battle/BattleEffect";
import { addBattleEffect, effectAppliedMessage } from "@/domain/battle/BattleEffect";
import { AMBUSH_FLAVOR, maxHp, maxStamina } from "@/domain/battle/battleConfig";
import { computeDamage } from "@/domain/battle/services/DamageCalculator";
import { rollEffectProc } from "@/domain/battle/services/EffectResolver";
import { rollHit } from "@/domain/battle/services/HitCheck";
import type { DungeonTier } from "@/domain/dungeon/dungeonTierForPlayerLevel";
import type { Monster } from "@/domain/monster/Monster";
import type { BattleEffectKind } from "@/domain/monster/MonsterAttack";
import type { Player } from "@/domain/player/Player";
import type { Attributes, AttributeValues } from "@/domain/shared/Attributes";
import type { Rng } from "@/domain/shared/Rng";
import type { BattleRepository } from "@/usecase/battle/BattleRepository";
import { defaultMonsterAttack } from "@/usecase/battle/combatStance";
import { settlePlayerDeath } from "@/usecase/battle/deathSettlement";
import type { EffectCounterRepository } from "@/usecase/battle/EffectCounterRepository";
import { resolveCounterItemId } from "@/usecase/battle/resolveCounterItem";
import type { BattleStatusOutput, MonsterStatusOutput } from "@/usecase/battle/StartBattleUseCase";
import type { LevelRepository } from "@/usecase/level/LevelRepository";
import type { MonsterCatalogCache } from "@/usecase/monster/MonsterCatalogCache";
import type { PlayerRepository } from "@/usecase/player/PlayerRepository";

function pick<T>(items: T[], rng: Rng): T {
  const item = items[rng.int(0, items.length - 1)];
  if (item === undefined) throw new Error("Cannot pick from an empty list");
  return item;
}

export interface BeginDungeonFightParams {
  player: Player;
  monster: Monster;
  dungeonTier: DungeonTier;
  isBossFight: boolean;
  effectiveAttributes: Attributes;
  monsterCatalogCache: MonsterCatalogCache;
  effectCounterRepository: EffectCounterRepository;
  levelRepository: LevelRepository;
  playerRepository: PlayerRepository;
  battleRepository: BattleRepository;
  rng: Rng;
}

export interface BeginDungeonFightOutput {
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
  ambushOccurred: boolean;
  outcome: "ongoing" | "lost";
}

/**
 * Sets up one dungeon fight against an already-selected monster (already
 * Dungeon-Enhanced if it's a step, plan3 §2c-shaped if it's the
 * materialize-or-reuse boss): ambush roll, death check, Battle row creation
 * — shared by StartDungeonUseCase (step 1) and ContinueDungeonUseCase (later
 * steps / the boss reveal) so this block isn't duplicated a third time
 * alongside StartBattleUseCase's own near-identical copy (which also has to
 * handle the 20% empty-encounter roll dungeons don't).
 */
export async function beginDungeonFight(
  params: BeginDungeonFightParams,
): Promise<BeginDungeonFightOutput> {
  const {
    player,
    monster,
    dungeonTier,
    isBossFight,
    effectiveAttributes,
    monsterCatalogCache,
    effectCounterRepository,
    levelRepository,
    playerRepository,
    battleRepository,
    rng,
  } = params;

  const moveset = await monsterCatalogCache.getMoveset(monster.id);
  const playerMaxHp = maxHp(effectiveAttributes.vitality, effectiveAttributes.strength);
  const playerMaxStamina = maxStamina(player.level);
  const monsterMaxStamina = monster.maxStamina;

  let playerCurrentHp = playerMaxHp;
  let ambushOccurred = false;
  let playerEffects: BattleEffect[] = [];
  let ambushEffectMessage: string | null = null;

  // Ambush can still roll normally on top of the guaranteed encounter (the
  // dungeon never skips finding a monster; only the ambush chance itself is
  // a real roll, plan3 §2b/§2c).
  if (rng.int(1, 100) <= monster.ambushChance) {
    ambushOccurred = true;
    const nonSpecialMoveset = moveset.filter((a) => !a.isSpecial);
    const ambushAttack =
      nonSpecialMoveset.length > 0 ? pick(nonSpecialMoveset, rng) : defaultMonsterAttack(moveset);

    const hit = rollHit(
      {
        attackerDexterity: monster.getAttributes().dexterity,
        defenderAgility: effectiveAttributes.agility,
        attackerLuck: monster.getAttributes().luck,
      },
      rng,
    );

    if (hit) {
      const damage = computeDamage({
        attackMultiplier: ambushAttack.multiplier,
        attackerScalingValue: monster.getAttributes().get(ambushAttack.scalingAttribute),
        staminaCost: ambushAttack.staminaCost,
        defenderLevel: player.level,
        defenderScalingValue: effectiveAttributes.get(ambushAttack.scalingAttribute),
      });
      playerCurrentHp = Math.max(0, playerCurrentHp - damage);

      const proced = rollEffectProc(
        { attackerLuck: monster.getAttributes().luck, defenderLuck: effectiveAttributes.luck },
        rng,
      );
      if (proced) {
        const kind: BattleEffectKind = ambushAttack.appliesEffect ?? monster.innateEffectKind;
        const counterItemId = await resolveCounterItemId(kind, effectCounterRepository);
        playerEffects = addBattleEffect(playerEffects, kind, {
          inflictorLevel: monster.level,
          victimLevel: player.level,
          counterItemId,
        });
        ambushEffectMessage = effectAppliedMessage(kind);
      }
    }
  }

  if (playerCurrentHp <= 0) {
    await settlePlayerDeath(player, levelRepository, playerRepository);
    return {
      monster: null,
      message: pick([...AMBUSH_FLAVOR], rng),
      playerStatus: null,
      monsterStatus: null,
      ambushOccurred: true,
      outcome: "lost",
    };
  }

  const battle = Battle.create({
    id: Bun.randomUUIDv7(),
    playerId: player.id,
    monsterId: monster.id,
    playerCurrentHp,
    playerCurrentStamina: playerMaxStamina,
    monsterCurrentHp: monster.hp,
    monsterCurrentStamina: monsterMaxStamina,
    round: 1,
    playerEffects,
    monsterEffects: [],
    monsterChargingAttackId: null,
    chargeRoundsLeft: 0,
    monsterAttackWeights: {},
    statusCooldownRoundsLeft: 0,
    dungeonTier,
    dungeonIsBossFight: isBossFight,
    revealedMonsterAttributes: [],
  });
  await battleRepository.create(battle);

  return {
    monster: {
      id: monster.id,
      name: monster.name,
      description: monster.description,
      monsterImage: monster.monsterImage,
      hp: monster.hp,
      // Fresh battle — nothing revealed yet.
      attributes: {},
    },
    message: ambushOccurred
      ? [pick([...AMBUSH_FLAVOR], rng), ambushEffectMessage].filter(Boolean).join(" ")
      : null,
    playerStatus: {
      currentHp: playerCurrentHp,
      maxHp: playerMaxHp,
      currentStamina: playerMaxStamina,
      maxStamina: playerMaxStamina,
    },
    monsterStatus: {
      currentHp: monster.hp,
      maxHp: monster.hp,
    },
    ambushOccurred,
    outcome: "ongoing",
  };
}
