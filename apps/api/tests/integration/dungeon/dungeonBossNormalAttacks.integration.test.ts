import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { DungeonBossNotFoundError } from "@/usecase/dungeon/errors";
import { MonsterAttackNotFoundError } from "@/usecase/monster/errors";
import { buildUseCases } from "../support/buildUseCases";
import { expectRejection } from "../support/expectRejection";
import { FakeRng } from "../support/FakeRng";
import { getSharedPostgresEnvironment } from "../support/sharedPostgresEnvironment";
import {
  createTestDungeonBoss,
  createTestMonsterAttack,
  linkDungeonBossMoveset,
} from "../support/testFixtures";

describe("GetDungeonBossNormalAttacksUseCase (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("returns only the boss's normal attack ids, not its specials (happy path)", async () => {
    const bossId = await createTestDungeonBoss(sql);
    const normal1 = await createTestMonsterAttack(sql);
    const normal2 = await createTestMonsterAttack(sql);
    const special = await createTestMonsterAttack(sql, { isSpecial: true, chargeTurns: 1 });
    await linkDungeonBossMoveset(sql, bossId, normal1);
    await linkDungeonBossMoveset(sql, bossId, normal2);
    await linkDungeonBossMoveset(sql, bossId, special);
    const uc = buildUseCases(sql, new FakeRng([1]));

    const ids = await uc.getDungeonBossNormalAttacksUseCase.execute(bossId);

    expect(new Set(ids)).toEqual(new Set([normal1, normal2]));
  });

  it("returns an empty list for a boss with no normal attacks (edge case)", async () => {
    const bossId = await createTestDungeonBoss(sql);
    const uc = buildUseCases(sql, new FakeRng([1]));

    const ids = await uc.getDungeonBossNormalAttacksUseCase.execute(bossId);

    expect(ids).toEqual([]);
  });

  it("rejects a dungeon boss id that doesn't exist (edge case)", async () => {
    const uc = buildUseCases(sql, new FakeRng([1]));

    await expectRejection(
      uc.getDungeonBossNormalAttacksUseCase.execute(Bun.randomUUIDv7()),
      DungeonBossNotFoundError,
    );
  });
});

describe("SetDungeonBossNormalAttacksUseCase (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("links exactly the given normal attacks, unbounded count (happy path)", async () => {
    const bossId = await createTestDungeonBoss(sql);
    const normal1 = await createTestMonsterAttack(sql);
    const normal2 = await createTestMonsterAttack(sql);
    const normal3 = await createTestMonsterAttack(sql);
    const uc = buildUseCases(sql, new FakeRng([1]));

    const result = await uc.setDungeonBossNormalAttacksUseCase.execute({
      dungeonBossId: bossId,
      attackIds: [normal1, normal2, normal3],
    });

    expect(new Set(result)).toEqual(new Set([normal1, normal2, normal3]));
    const persisted = await uc.monsterAttackRepository.findDungeonBossNormalAttackIds(bossId);
    expect(new Set(persisted)).toEqual(new Set([normal1, normal2, normal3]));
  });

  it("replaces a previous normal-attack set wholesale (happy path)", async () => {
    const bossId = await createTestDungeonBoss(sql);
    const oldNormal = await createTestMonsterAttack(sql);
    const newNormal = await createTestMonsterAttack(sql);
    const uc = buildUseCases(sql, new FakeRng([1]));
    await uc.setDungeonBossNormalAttacksUseCase.execute({
      dungeonBossId: bossId,
      attackIds: [oldNormal],
    });

    await uc.setDungeonBossNormalAttacksUseCase.execute({
      dungeonBossId: bossId,
      attackIds: [newNormal],
    });

    const persisted = await uc.monsterAttackRepository.findDungeonBossNormalAttackIds(bossId);
    expect(persisted).toEqual([newNormal]);
  });

  it("leaves the boss's special-attack links untouched (edge case)", async () => {
    const bossId = await createTestDungeonBoss(sql);
    const special = await createTestMonsterAttack(sql, { isSpecial: true, chargeTurns: 1 });
    await linkDungeonBossMoveset(sql, bossId, special);
    const normal = await createTestMonsterAttack(sql);
    const uc = buildUseCases(sql, new FakeRng([1]));

    await uc.setDungeonBossNormalAttacksUseCase.execute({
      dungeonBossId: bossId,
      attackIds: [normal],
    });

    const rows = await sql<
      { monster_attack_id: string }[]
    >`select monster_attack_id from dungeon_boss_movesets where dungeon_boss_id = ${bossId}`;
    expect(new Set(rows.map((r) => r.monster_attack_id))).toEqual(new Set([special, normal]));
  });

  it("rejects a dungeon boss id that doesn't exist (edge case)", async () => {
    const uc = buildUseCases(sql, new FakeRng([1]));

    await expectRejection(
      uc.setDungeonBossNormalAttacksUseCase.execute({
        dungeonBossId: Bun.randomUUIDv7(),
        attackIds: [],
      }),
      DungeonBossNotFoundError,
    );
  });

  it("rejects an attack id that doesn't exist (edge case)", async () => {
    const bossId = await createTestDungeonBoss(sql);
    const uc = buildUseCases(sql, new FakeRng([1]));

    await expectRejection(
      uc.setDungeonBossNormalAttacksUseCase.execute({
        dungeonBossId: bossId,
        attackIds: [Bun.randomUUIDv7()],
      }),
      MonsterAttackNotFoundError,
    );
  });

  it("rejects a special attack — specials go through the special-attacks endpoint (edge case)", async () => {
    const bossId = await createTestDungeonBoss(sql);
    const special = await createTestMonsterAttack(sql, { isSpecial: true, chargeTurns: 1 });
    const uc = buildUseCases(sql, new FakeRng([1]));

    await expectRejection(
      uc.setDungeonBossNormalAttacksUseCase.execute({
        dungeonBossId: bossId,
        attackIds: [special],
      }),
      Error,
    );
  });
});
