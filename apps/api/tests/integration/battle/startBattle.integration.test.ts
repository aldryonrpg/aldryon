import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { Battle } from "@/domain/battle/Battle";
import { BattleAlreadyInProgressError, RunCooldownError } from "@/usecase/battle/errors";
import { buildUseCases } from "../support/buildUseCases";
import { expectRejection } from "../support/expectRejection";
import { FakeRng } from "../support/FakeRng";
import { getSharedPostgresEnvironment } from "../support/sharedPostgresEnvironment";
import {
  createTestMonster,
  createTestMonsterAttack,
  createTestPlayer,
  createTestUser,
  linkMonsterMoveset,
} from "../support/testFixtures";

describe("StartBattleUseCase (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("finds a monster and creates a battle row (happy path)", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId);
    const monsterId = await createTestMonster(sql, { region: "mountain", hp: 50, ambushChance: 0 });
    const attackId = await createTestMonsterAttack(sql, { staminaCost: 0, multiplier: 0.4 });
    await linkMonsterMoveset(sql, monsterId, attackId);

    // roll1=50 (>20, not empty), roll2=1 (region monsters ordered by name:
    // seeded ORC SOLDIER sorts before "Test Monster ..." so index 1 is this
    // fixture's own monster), roll3=1 (ambush fails, chance=0)
    const uc = buildUseCases(sql, new FakeRng([50, 1, 1]));

    const result = await uc.startBattleUseCase.execute({
      playerId,
      isVip: false,
      region: "mountain",
    });

    expect(result.outcome).toBe("ongoing");
    expect(result.monster?.id).toBe(monsterId);
    expect(result.availableAttacks.some((a) => a.name === "HIT")).toBe(true);

    const battle = await uc.battleRepository.findByPlayerId(playerId);
    expect(battle).not.toBeNull();
    expect(battle?.monsterId).toBe(monsterId);
  });

  it("lands a free ambush strike before the player acts, including its effect proc", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { dexterity: 1, luck: 1 });
    const monsterId = await createTestMonster(sql, {
      region: "ruins",
      hp: 50,
      ambushChance: 100,
      dexterity: 10,
      luck: 25,
      force: 5,
      monsterType: "poisonous",
    });
    const attackId = await createTestMonsterAttack(sql, { staminaCost: 0, multiplier: 1 });
    await linkMonsterMoveset(sql, monsterId, attackId);

    // roll1=50 (not empty), roll2=1 (region monsters ordered by name: seeded
    // SKELETON GUARD sorts before "Test Monster ..." so index 1 is this
    // fixture's own monster), roll3=1 (ambush rolls <=100 -> lands), roll4=0
    // (pick the only non-special attack) — the hit itself needs no roll
    // (10/1*100+25 >= 100 -> guaranteed hit), roll5=20 (effect proc: 20 <=
    // monster luck 25 - player luck 1 -> lands), roll6=0 (pick the ambush
    // flavor message).
    const uc = buildUseCases(sql, new FakeRng([50, 1, 1, 0, 20, 0]));

    const result = await uc.startBattleUseCase.execute({
      playerId,
      isVip: false,
      region: "ruins",
    });

    expect(result.outcome).toBe("ongoing");
    expect(result.ambushOccurred).toBe(true);
    expect(result.playerStatus?.currentHp).toBeLessThan(result.playerStatus?.maxHp ?? 0);
    expect(result.message).toBeTruthy();

    const battle = await uc.battleRepository.findByPlayerId(playerId);
    expect(battle?.playerEffects).toEqual([
      {
        type: "dot",
        kind: "poison",
        damagePerRound: expect.any(Number),
        counterItemId: expect.any(String),
      },
    ]);
  });

  it("returns an empty encounter 20% of the time (seeded Rng)", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId);

    // roll1=10 (<=20 -> empty), roll2=0 (pick the flavor message)
    const uc = buildUseCases(sql, new FakeRng([10, 0]));

    const result = await uc.startBattleUseCase.execute({
      playerId,
      isVip: false,
      region: "ruins",
    });

    expect(result.outcome).toBeNull();
    expect(result.monster).toBeNull();
    expect(result.message).toBeTruthy();

    const battle = await uc.battleRepository.findByPlayerId(playerId);
    expect(battle).toBeNull();
  });

  it("rejects starting a second battle while one is already in progress (409)", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId);
    const monsterId = await createTestMonster(sql, { region: "ruins" });

    const uc = buildUseCases(sql, new FakeRng([1]));
    await uc.battleRepository.create(
      Battle.create({
        id: Bun.randomUUIDv7(),
        playerId,
        monsterId,
        playerCurrentHp: 100,
        playerCurrentStamina: 25,
        monsterCurrentHp: 50,
        monsterCurrentStamina: 25,
        round: 1,
        playerEffects: [],
        monsterEffects: [],
        monsterChargingAttackId: null,
        chargeRoundsLeft: 0,
        monsterAttackWeights: {},
        stunCooldownRoundsLeft: 0,
        dungeonIsBossFight: false,
        dungeonTier: null,
      }),
    );

    await expectRejection(
      uc.startBattleUseCase.execute({ playerId, isVip: false, region: "ruins" }),
      BattleAlreadyInProgressError,
    );
  });

  it("rejects starting a battle within the run cooldown window (429)", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { lastRunAt: new Date() });

    const uc = buildUseCases(sql, new FakeRng([1]));

    await expectRejection(
      uc.startBattleUseCase.execute({ playerId, isVip: false, region: "sewage" }),
      RunCooldownError,
    );
  });

  it("uses the shorter 15s cooldown for VIP players", async () => {
    const userId = await createTestUser(sql, { isVip: true });
    const twentySecondsAgo = new Date(Date.now() - 20_000);
    const playerId = await createTestPlayer(sql, userId, { lastRunAt: twentySecondsAgo });

    // roll1=50 (not empty), roll2=0 (the seeded BANDIT SOLDIER is the only
    // bandit-region monster), roll3=99 (>ambushChance 10 -> no ambush, so no
    // further rolls are drawn).
    const uc = buildUseCases(sql, new FakeRng([50, 0, 99]));

    // Past the 15s VIP window (but would still be inside the 30s normal one).
    const result = await uc.startBattleUseCase.execute({ playerId, isVip: true, region: "bandit" });
    expect(result).toBeTruthy();
  });

  it("allows an immediate restart right after death — dying has no cooldown", async () => {
    const userId = await createTestUser(sql);
    // lastDeathAt set to just now; lastRunAt stays null — only the latter
    // gates the cooldown (plan2 §4 step 1a).
    const playerId = await createTestPlayer(sql, userId, { lastDeathAt: new Date() });
    const monsterId = await createTestMonster(sql, { region: "sewage", hp: 50, ambushChance: 0 });
    const attackId = await createTestMonsterAttack(sql, { staminaCost: 0, multiplier: 0.4 });
    await linkMonsterMoveset(sql, monsterId, attackId);

    // roll1=50 (not empty), roll2=1 (region monsters ordered by name: seeded
    // SEWER RAT sorts before "Test Monster ..." so index 1 is this
    // fixture's own monster), roll3=1 (ambush fails, chance=0)
    const uc = buildUseCases(sql, new FakeRng([50, 1, 1]));

    const result = await uc.startBattleUseCase.execute({
      playerId,
      isVip: false,
      region: "sewage",
    });
    expect(result.outcome).toBe("ongoing");
  });
});
