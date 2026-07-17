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
});
