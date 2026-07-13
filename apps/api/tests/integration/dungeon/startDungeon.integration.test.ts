import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { Battle } from "@/domain/battle/Battle";
import { BattleAlreadyInProgressError } from "@/usecase/battle/errors";
import {
  BelowMinimumDungeonLevelError,
  DailyDungeonLimitReachedError,
} from "@/usecase/dungeon/errors";
import { buildUseCases } from "../support/buildUseCases";
import { expectRejection } from "../support/expectRejection";
import { FakeRng } from "../support/FakeRng";
import { getSharedPostgresEnvironment } from "../support/sharedPostgresEnvironment";
import {
  createTestMonster,
  createTestPlayer,
  createTestUser,
  setPlayerDungeonAttempts,
} from "../support/testFixtures";

/**
 * The dungeon's gatekeeper/boss pairing is a true singleton in production
 * (plan3 §2c: exactly one dungeon_encounters row, seeded by migration
 * `20260713090080_seed_dungeon_boss_and_encounter.sql` — the existing Snake
 * as gatekeeper, the Dragon as boss). Tests reuse that real seeded pairing
 * rather than inserting a second one — the shared testcontainers Postgres
 * only ever has room for the one row `DungeonEncounterRepository.findOne()`
 * assumes, and a second row would make which one it returns non-deterministic
 * for every other dungeon test sharing the same container.
 */
async function findSeededGatekeeperId(sql: SQL): Promise<string> {
  const rows = await sql<{ id: string }[]>`select id from monsters where name = 'SNAKE' limit 1`;
  const id = rows[0]?.id;
  if (!id) throw new Error("Seeded SNAKE monster not found — did migrations run?");
  return id;
}

// The Snake's seeded ambush_chance is 10 — any Rng queue whose first value is
// above 10 guarantees no ambush, keeping these tests focused on the dungeon
// mechanics rather than the (already-covered-elsewhere) ambush flow.
const NO_AMBUSH_RNG = () => new FakeRng([50]);

describe("StartDungeonUseCase (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("rejects a player below level 10 (403)", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { level: 9 });
    const uc = buildUseCases(sql, NO_AMBUSH_RNG());

    await expectRejection(
      uc.startDungeonUseCase.execute({ playerId, isVip: false }),
      BelowMinimumDungeonLevelError,
    );
  });

  it("always encounters the gatekeeper and materializes the tier-1 boss (happy path)", async () => {
    const gatekeeperId = await findSeededGatekeeperId(sql);
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { level: 12, force: 10 });
    const uc = buildUseCases(sql, NO_AMBUSH_RNG());

    const result = await uc.startDungeonUseCase.execute({ playerId, isVip: false });

    expect(result.outcome).toBe("ongoing");
    expect(result.monster?.id).toBe(gatekeeperId);

    const battle = await uc.battleRepository.findByPlayerId(playerId);
    expect(battle?.monsterId).toBe(gatekeeperId);
    expect(battle?.dungeonTier).toBe(1);
    expect(battle?.dungeonBossMonsterId).not.toBeNull();

    const materialized = await uc.monsterRepository.findById(
      battle?.dungeonBossMonsterId as string,
    );
    expect(materialized?.name).toBe("Dragon — Tier 1");
    expect(materialized?.hp).toBe(2000); // tier 1 -> 100% of the seeded base 2000
    expect(materialized?.level).toBe(10);
  });

  it("materializes the boss idempotently: two players at the same tier reuse the same row", async () => {
    const userId1 = await createTestUser(sql);
    const playerId1 = await createTestPlayer(sql, userId1, { level: 12 });
    const userId2 = await createTestUser(sql);
    const playerId2 = await createTestPlayer(sql, userId2, { level: 13 });
    const uc = buildUseCases(sql, NO_AMBUSH_RNG());

    const result1 = await uc.startDungeonUseCase.execute({ playerId: playerId1, isVip: false });
    const result2 = await uc.startDungeonUseCase.execute({ playerId: playerId2, isVip: false });

    const battle1 = await uc.battleRepository.findByPlayerId(playerId1);
    const battle2 = await uc.battleRepository.findByPlayerId(playerId2);
    expect(battle1?.dungeonBossMonsterId).toBe(battle2?.dungeonBossMonsterId as string);
    expect(result1.outcome).toBe("ongoing");
    expect(result2.outcome).toBe("ongoing");
  });

  it("a higher-level player faces a visibly tougher (tier 2) materialized boss", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { level: 15 });
    const uc = buildUseCases(sql, NO_AMBUSH_RNG());

    await uc.startDungeonUseCase.execute({ playerId, isVip: false });

    const battle = await uc.battleRepository.findByPlayerId(playerId);
    expect(battle?.dungeonTier).toBe(2);
    const materialized = await uc.monsterRepository.findById(
      battle?.dungeonBossMonsterId as string,
    );
    expect(materialized?.name).toBe("Dragon — Tier 2");
    expect(materialized?.hp).toBe(3000); // tier 2 -> 150% of the seeded base 2000
    expect(materialized?.level).toBe(15);
  });

  it("rejects entering while a battle (wild or dungeon) is already in progress (409)", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { level: 12 });
    const monsterId = await createTestMonster(sql, { region: "forest" });
    const uc = buildUseCases(sql, NO_AMBUSH_RNG());
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
        dungeonBossMonsterId: null,
        dungeonTier: null,
      }),
    );

    await expectRejection(
      uc.startDungeonUseCase.execute({ playerId, isVip: false }),
      BattleAlreadyInProgressError,
    );
  });

  it("daily limit: normal player gets 1 attempt/day, VIP gets 2, both reset the next UTC day", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { level: 12 });
    const uc = buildUseCases(sql, NO_AMBUSH_RNG());

    await uc.startDungeonUseCase.execute({ playerId, isVip: false });
    await uc.battleRepository.deleteByPlayerId(playerId);

    await expectRejection(
      uc.startDungeonUseCase.execute({ playerId, isVip: false }),
      DailyDungeonLimitReachedError,
    );

    const vipUserId = await createTestUser(sql, { isVip: true });
    const vipPlayerId = await createTestPlayer(sql, vipUserId, { level: 12 });

    await uc.startDungeonUseCase.execute({ playerId: vipPlayerId, isVip: true });
    await uc.battleRepository.deleteByPlayerId(vipPlayerId);
    await uc.startDungeonUseCase.execute({ playerId: vipPlayerId, isVip: true });
    await uc.battleRepository.deleteByPlayerId(vipPlayerId);

    await expectRejection(
      uc.startDungeonUseCase.execute({ playerId: vipPlayerId, isVip: true }),
      DailyDungeonLimitReachedError,
    );

    // Simulate "yesterday" for the normal player -> eligible again today.
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await setPlayerDungeonAttempts(sql, playerId, yesterday, null);
    const result = await uc.startDungeonUseCase.execute({ playerId, isVip: false });
    expect(result.outcome).toBe("ongoing");
  });
});
