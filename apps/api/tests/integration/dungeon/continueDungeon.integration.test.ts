import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { Battle } from "@/domain/battle/Battle";
import { BattleAlreadyInProgressError } from "@/usecase/battle/errors";
import { NoDungeonRunInProgressError } from "@/usecase/dungeon/errors";
import { buildUseCases } from "../support/buildUseCases";
import { expectRejection } from "../support/expectRejection";
import { FakeRng } from "../support/FakeRng";
import { getSharedPostgresEnvironment } from "../support/sharedPostgresEnvironment";
import {
  createTestMonster,
  createTestPlayer,
  createTestUser,
  setPlayerDungeonRun,
} from "../support/testFixtures";

// A step pick always rolls [monster-index, ambush-check]; ambush_chance on
// any seeded catalog monster tops out at 10, so a check value of 99
// guarantees no ambush regardless of which monster gets picked.
const STEP_RNG = () => new FakeRng([0, 99]);

describe("ContinueDungeonUseCase (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("rejects when no dungeon run is in progress", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { level: 12 });
    const uc = buildUseCases(sql, STEP_RNG());

    await expectRejection(
      uc.continueDungeonUseCase.execute({ playerId }),
      NoDungeonRunInProgressError,
    );
  });

  it("rejects while a battle is already in progress", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { level: 12 });
    await setPlayerDungeonRun(sql, playerId, 2, 1, 3);
    const monsterId = await createTestMonster(sql, { region: "forest" });
    const uc = buildUseCases(sql, STEP_RNG());
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
        dungeonTier: null,
        dungeonIsBossFight: false,
        revealedMonsterAttributes: [],
      }),
    );

    await expectRejection(
      uc.continueDungeonUseCase.execute({ playerId }),
      BattleAlreadyInProgressError,
    );
  });

  it("advances to the next step (not yet the last) with a live Dungeon-Enhanced monster", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { level: 15 });
    // Tier 2 has 3 steps; currently on step 1 of 3.
    await setPlayerDungeonRun(sql, playerId, 2, 1, 3);
    const uc = buildUseCases(sql, STEP_RNG());

    const result = await uc.continueDungeonUseCase.execute({ playerId });

    expect(result.outcome).toBe("ongoing");
    const battle = await uc.battleRepository.findByPlayerId(playerId);
    expect(battle?.dungeonTier).toBe(2);
    expect(battle?.dungeonIsBossFight).toBe(false);

    const player = await uc.playerRepository.findById(playerId);
    expect(player?.dungeonRunStep).toBe(2);
    expect(player?.dungeonRunTotalSteps).toBe(3);
  });

  it("reveals the materialized boss once the last step is done, and the Growl always narrates", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { level: 12 });
    // Tier 1 has exactly 1 step, already done -> next Continue reveals the boss.
    await setPlayerDungeonRun(sql, playerId, 1, 1, 1);
    // roll1=1 (ambush check <= boss's ambush_chance 0 -> always fails),
    // roll2=0 (Growl break-percent roll).
    const uc = buildUseCases(sql, new FakeRng([1, 0]));

    const result = await uc.continueDungeonUseCase.execute({ playerId });

    expect(result.outcome).toBe("ongoing");
    expect(result.message).toContain("Growl");
    expect(result.monster?.name).toBe("Dragon — Tier 1");

    const battle = await uc.battleRepository.findByPlayerId(playerId);
    expect(battle?.dungeonIsBossFight).toBe(true);
    expect(battle?.dungeonTier).toBe(1);

    // Run progress is left in place (still mid-run) until the boss is
    // actually killed or the player exits/dies.
    const player = await uc.playerRepository.findById(playerId);
    expect(player?.dungeonRunTier).toBe(1);
  });

  it("reuses the same materialized boss row across independent players at the same tier", async () => {
    const userId1 = await createTestUser(sql);
    const playerId1 = await createTestPlayer(sql, userId1, { level: 16 });
    await setPlayerDungeonRun(sql, playerId1, 2, 3, 3);
    const userId2 = await createTestUser(sql);
    const playerId2 = await createTestPlayer(sql, userId2, { level: 17 });
    await setPlayerDungeonRun(sql, playerId2, 2, 3, 3);
    const uc = buildUseCases(sql, new FakeRng([1, 0]));

    const result1 = await uc.continueDungeonUseCase.execute({ playerId: playerId1 });
    await uc.battleRepository.deleteByPlayerId(playerId1);
    const result2 = await uc.continueDungeonUseCase.execute({ playerId: playerId2 });

    expect(result1.monster?.id).toBe(result2.monster?.id);
    expect(result1.monster?.name).toBe("Dragon — Tier 2");
  });
});
