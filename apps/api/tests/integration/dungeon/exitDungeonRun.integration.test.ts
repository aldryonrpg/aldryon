import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { NoDungeonRunInProgressError } from "@/usecase/dungeon/errors";
import { buildUseCases } from "../support/buildUseCases";
import { expectRejection } from "../support/expectRejection";
import { FakeRng } from "../support/FakeRng";
import { getSharedPostgresEnvironment } from "../support/sharedPostgresEnvironment";
import { createTestPlayer, createTestUser, setPlayerDungeonRun } from "../support/testFixtures";

describe("ExitDungeonRunUseCase (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("clears an in-progress run's dungeon_run_* columns", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { level: 12 });
    await setPlayerDungeonRun(sql, playerId, 2, 2, 3);
    const uc = buildUseCases(sql, new FakeRng([1]));

    await uc.exitDungeonRunUseCase.execute({ playerId });

    const player = await uc.playerRepository.findById(playerId);
    expect(player?.dungeonRunTier).toBeNull();
    expect(player?.dungeonRunStep).toBeNull();
    expect(player?.dungeonRunTotalSteps).toBeNull();
  });

  it("rejects when there's no run to exit", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { level: 12 });
    const uc = buildUseCases(sql, new FakeRng([1]));

    await expectRejection(
      uc.exitDungeonRunUseCase.execute({ playerId }),
      NoDungeonRunInProgressError,
    );
  });

  it("unblocks a fresh /dungeon/start after exiting", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { level: 12 });
    await setPlayerDungeonRun(sql, playerId, 1, 1, 1);
    const uc = buildUseCases(sql, new FakeRng([0, 99]));

    await uc.exitDungeonRunUseCase.execute({ playerId });
    const result = await uc.startDungeonUseCase.execute({ playerId });

    expect(result.outcome).toBe("ongoing");
  });
});
