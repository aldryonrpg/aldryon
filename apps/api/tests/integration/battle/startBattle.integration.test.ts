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

    // roll1=50 (>20, not empty), roll2=0 (pick the only monster), roll3=1 (ambush fails, chance=0)
    const uc = buildUseCases(sql, new FakeRng([50, 0, 1]));

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

  it("returns an empty encounter 20% of the time (seeded Rng)", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId);

    // roll1=10 (<=20 -> empty), roll2=0 (pick the flavor message)
    const uc = buildUseCases(sql, new FakeRng([10, 0]));

    const result = await uc.startBattleUseCase.execute({
      playerId,
      isVip: false,
      region: "dungeon",
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

    const uc = buildUseCases(sql, new FakeRng([50, 0, 1]));

    // Past the 15s VIP window (but would still be inside the 30s normal one).
    const result = await uc.startBattleUseCase.execute({ playerId, isVip: true, region: "bandit" });
    expect(result).toBeTruthy();
  });
});
