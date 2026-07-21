import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { Battle } from "@/domain/battle/Battle";
import { maxHp } from "@/domain/battle/battleConfig";
import { buildUseCases } from "../support/buildUseCases";
import { FakeRng } from "../support/FakeRng";
import { getSharedPostgresEnvironment } from "../support/sharedPostgresEnvironment";
import {
  createTestMonster,
  createTestMonsterAttack,
  createTestPlayer,
  createTestUser,
  linkMonsterMoveset,
} from "../support/testFixtures";

describe("GetActiveBattleUseCase (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("returns null when the player has no battle in progress", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId);
    const uc = buildUseCases(sql, new FakeRng([1]));

    const result = await uc.getActiveBattleUseCase.execute({ playerId });

    expect(result).toBeNull();
  });

  it("returns the live battle's monster/statuses/availableAttacks", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { strength: 10 });
    const monsterId = await createTestMonster(sql, { hp: 100, maxStamina: 50 });
    const monsterAttackId = await createTestMonsterAttack(sql, { staminaCost: 0 });
    await linkMonsterMoveset(sql, monsterId, monsterAttackId);

    const playerMaxHp = maxHp(1, 10);
    const battle = Battle.create({
      id: Bun.randomUUIDv7(),
      playerId,
      monsterId,
      playerCurrentHp: playerMaxHp,
      playerCurrentStamina: 10,
      monsterCurrentHp: 80,
      monsterCurrentStamina: 40,
      round: 1,
      playerEffects: [],
      monsterEffects: [],
      monsterChargingAttackId: null,
      chargeRoundsLeft: 0,
      monsterAttackWeights: {},
      statusCooldownRoundsLeft: 0,
      dungeonIsBossFight: false,
      revealedMonsterAttributes: [],
      dungeonTier: null,
    });
    const uc = buildUseCases(sql, new FakeRng([1]));
    await uc.battleRepository.create(battle);

    const result = await uc.getActiveBattleUseCase.execute({ playerId });

    expect(result?.monster.id).toBe(monsterId);
    expect(result?.playerStatus).toEqual({
      currentHp: playerMaxHp,
      maxHp: playerMaxHp,
      currentStamina: 10,
      maxStamina: 25,
    });
    expect(result?.monsterStatus).toEqual({
      currentHp: 80,
      maxHp: 100,
    });
    expect(result?.availableAttacks.length).toBeGreaterThan(0);
    expect(result?.availableAttacks[0]).toHaveProperty("scalingAttribute");
  });

  // Regression coverage for the bug this fixes: a dungeon step monster's
  // Dungeon-Enhanced stats only ever existed in memory for the single
  // beginDungeonFight call that started the fight — MonsterCatalogCache only
  // ever holds the monster's base (unscaled) row. Before resolveBattleMonster,
  // re-fetching the battle here (the reload path — exactly what surfaced the
  // bug live: "Monster HP (300/150) 200%" for a tier-3 player) reported
  // maxHp straight from the unscaled catalog row instead of the tier-scaled
  // value, even though monsterCurrentHp (persisted on the Battle row at fight
  // start) was correctly scaled — current could end up exceeding max.
  describe("dungeon step monster — maxHp stays tier-scaled across reloads", () => {
    it("tier 1 (100%) reports maxHp unchanged from the catalog row", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId, { level: 10 });
      const monsterId = await createTestMonster(sql, { hp: 100 });
      const battle = Battle.create({
        id: Bun.randomUUIDv7(),
        playerId,
        monsterId,
        playerCurrentHp: 100,
        playerCurrentStamina: 25,
        monsterCurrentHp: 80,
        monsterCurrentStamina: 100,
        round: 1,
        playerEffects: [],
        monsterEffects: [],
        monsterChargingAttackId: null,
        chargeRoundsLeft: 0,
        monsterAttackWeights: {},
        statusCooldownRoundsLeft: 0,
        dungeonTier: 1,
        dungeonIsBossFight: false,
        revealedMonsterAttributes: [],
      });
      const uc = buildUseCases(sql, new FakeRng([1]));
      await uc.battleRepository.create(battle);

      const result = await uc.getActiveBattleUseCase.execute({ playerId });

      expect(result?.monsterStatus).toEqual({ currentHp: 80, maxHp: 100 });
    });

    it("tier 2 (150%) reports maxHp scaled up from the catalog row", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId, { level: 15 });
      const monsterId = await createTestMonster(sql, { hp: 100 });
      const battle = Battle.create({
        id: Bun.randomUUIDv7(),
        playerId,
        monsterId,
        playerCurrentHp: 100,
        playerCurrentStamina: 25,
        monsterCurrentHp: 120,
        monsterCurrentStamina: 100,
        round: 1,
        playerEffects: [],
        monsterEffects: [],
        monsterChargingAttackId: null,
        chargeRoundsLeft: 0,
        monsterAttackWeights: {},
        statusCooldownRoundsLeft: 0,
        dungeonTier: 2,
        dungeonIsBossFight: false,
        revealedMonsterAttributes: [],
      });
      const uc = buildUseCases(sql, new FakeRng([1]));
      await uc.battleRepository.create(battle);

      const result = await uc.getActiveBattleUseCase.execute({ playerId });

      // 100 base hp * 1.5 tier multiplier = 150 (scaleByTier's Math.ceil
      // convention, exact here since it divides evenly).
      expect(result?.monsterStatus).toEqual({ currentHp: 120, maxHp: 150 });
    });

    it("tier 3 (200%) reports maxHp scaled up from the catalog row — the exact bug reported live", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId, { level: 20 });
      const monsterId = await createTestMonster(sql, { hp: 100 });
      const battle = Battle.create({
        id: Bun.randomUUIDv7(),
        playerId,
        monsterId,
        playerCurrentHp: 100,
        playerCurrentStamina: 25,
        monsterCurrentHp: 150,
        monsterCurrentStamina: 100,
        round: 1,
        playerEffects: [],
        monsterEffects: [],
        monsterChargingAttackId: null,
        chargeRoundsLeft: 0,
        monsterAttackWeights: {},
        statusCooldownRoundsLeft: 0,
        dungeonTier: 3,
        dungeonIsBossFight: false,
        revealedMonsterAttributes: [],
      });
      const uc = buildUseCases(sql, new FakeRng([1]));
      await uc.battleRepository.create(battle);

      const result = await uc.getActiveBattleUseCase.execute({ playerId });

      // 100 base hp * 2.0 tier multiplier = 200 — before the fix this came
      // back as maxHp: 100 (the unscaled catalog row), with currentHp: 150
      // already exceeding it.
      expect(result?.monsterStatus).toEqual({ currentHp: 150, maxHp: 200 });
    });

    it("a materialized boss fight is NOT re-scaled a second time (already scaled once in the database)", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId, { level: 20 });
      // A materialized boss row already has its tier-scaled hp baked in
      // (DungeonBossOfTheDayUseCase) — resolveBattleMonster must leave a
      // dungeonIsBossFight battle's monster untouched, or this would double
      // the already-scaled hp on top of itself.
      const monsterId = await createTestMonster(sql, { hp: 200 });
      const battle = Battle.create({
        id: Bun.randomUUIDv7(),
        playerId,
        monsterId,
        playerCurrentHp: 100,
        playerCurrentStamina: 25,
        monsterCurrentHp: 200,
        monsterCurrentStamina: 100,
        round: 1,
        playerEffects: [],
        monsterEffects: [],
        monsterChargingAttackId: null,
        chargeRoundsLeft: 0,
        monsterAttackWeights: {},
        statusCooldownRoundsLeft: 0,
        dungeonTier: 3,
        dungeonIsBossFight: true,
        revealedMonsterAttributes: [],
      });
      const uc = buildUseCases(sql, new FakeRng([1]));
      await uc.battleRepository.create(battle);

      const result = await uc.getActiveBattleUseCase.execute({ playerId });

      expect(result?.monsterStatus).toEqual({ currentHp: 200, maxHp: 200 });
    });
  });
});
