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

describe("GetDungeonBossSpecialAttacksUseCase (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("returns only the boss's special attack ids, not its regular moveset (happy path)", async () => {
    const bossId = await createTestDungeonBoss(sql);
    const special1 = await createTestMonsterAttack(sql, { isSpecial: true, chargeTurns: 1 });
    const special2 = await createTestMonsterAttack(sql, { isSpecial: true, chargeTurns: 1 });
    const regular = await createTestMonsterAttack(sql);
    await linkDungeonBossMoveset(sql, bossId, special1);
    await linkDungeonBossMoveset(sql, bossId, special2);
    await linkDungeonBossMoveset(sql, bossId, regular);
    const uc = buildUseCases(sql, new FakeRng([1]));

    const ids = await uc.getDungeonBossSpecialAttacksUseCase.execute(bossId);

    expect(new Set(ids)).toEqual(new Set([special1, special2]));
  });

  it("returns an empty list for a boss with no special attacks (edge case)", async () => {
    const bossId = await createTestDungeonBoss(sql);
    const uc = buildUseCases(sql, new FakeRng([1]));

    const ids = await uc.getDungeonBossSpecialAttacksUseCase.execute(bossId);

    expect(ids).toEqual([]);
  });

  it("rejects a dungeon boss id that doesn't exist (edge case)", async () => {
    const uc = buildUseCases(sql, new FakeRng([1]));

    await expectRejection(
      uc.getDungeonBossSpecialAttacksUseCase.execute(Bun.randomUUIDv7()),
      DungeonBossNotFoundError,
    );
  });
});

describe("SetDungeonBossSpecialAttacksUseCase (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("links exactly the given special attacks (happy path)", async () => {
    const bossId = await createTestDungeonBoss(sql);
    const special1 = await createTestMonsterAttack(sql, { isSpecial: true, chargeTurns: 1 });
    const special2 = await createTestMonsterAttack(sql, { isSpecial: true, chargeTurns: 1 });
    const uc = buildUseCases(sql, new FakeRng([1]));

    const result = await uc.setDungeonBossSpecialAttacksUseCase.execute({
      dungeonBossId: bossId,
      attackIds: [special1, special2],
    });

    expect(new Set(result)).toEqual(new Set([special1, special2]));
    const persisted = await uc.monsterAttackRepository.findDungeonBossSpecialAttackIds(bossId);
    expect(new Set(persisted)).toEqual(new Set([special1, special2]));
  });

  it("replaces a previous special-attack set wholesale (happy path)", async () => {
    const bossId = await createTestDungeonBoss(sql);
    const oldSpecial = await createTestMonsterAttack(sql, { isSpecial: true, chargeTurns: 1 });
    const newSpecial = await createTestMonsterAttack(sql, { isSpecial: true, chargeTurns: 1 });
    const uc = buildUseCases(sql, new FakeRng([1]));
    await uc.setDungeonBossSpecialAttacksUseCase.execute({
      dungeonBossId: bossId,
      attackIds: [oldSpecial],
    });

    await uc.setDungeonBossSpecialAttacksUseCase.execute({
      dungeonBossId: bossId,
      attackIds: [newSpecial],
    });

    const persisted = await uc.monsterAttackRepository.findDungeonBossSpecialAttackIds(bossId);
    expect(persisted).toEqual([newSpecial]);
  });

  it("leaves the boss's regular (non-special) moveset untouched (edge case)", async () => {
    const bossId = await createTestDungeonBoss(sql);
    const regular = await createTestMonsterAttack(sql);
    await linkDungeonBossMoveset(sql, bossId, regular);
    const special = await createTestMonsterAttack(sql, { isSpecial: true, chargeTurns: 1 });
    const uc = buildUseCases(sql, new FakeRng([1]));

    await uc.setDungeonBossSpecialAttacksUseCase.execute({
      dungeonBossId: bossId,
      attackIds: [special],
    });

    const rows = await sql<
      { monster_attack_id: string }[]
    >`select monster_attack_id from dungeon_boss_movesets where dungeon_boss_id = ${bossId}`;
    expect(new Set(rows.map((r) => r.monster_attack_id))).toEqual(new Set([regular, special]));
  });

  it("rejects a dungeon boss id that doesn't exist (edge case)", async () => {
    const uc = buildUseCases(sql, new FakeRng([1]));

    await expectRejection(
      uc.setDungeonBossSpecialAttacksUseCase.execute({
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
      uc.setDungeonBossSpecialAttacksUseCase.execute({
        dungeonBossId: bossId,
        attackIds: [Bun.randomUUIDv7()],
      }),
      MonsterAttackNotFoundError,
    );
  });

  it("rejects an attack that exists but isn't a special attack (edge case)", async () => {
    const bossId = await createTestDungeonBoss(sql);
    const regular = await createTestMonsterAttack(sql, { isSpecial: false });
    const uc = buildUseCases(sql, new FakeRng([1]));

    await expectRejection(
      uc.setDungeonBossSpecialAttacksUseCase.execute({
        dungeonBossId: bossId,
        attackIds: [regular],
      }),
      Error,
    );
  });

  it("is rejected by the DB-level moveset limit even if a caller bypasses the DTO's max(2) (defense in depth)", async () => {
    const bossId = await createTestDungeonBoss(sql);
    const special1 = await createTestMonsterAttack(sql, { isSpecial: true, chargeTurns: 1 });
    const special2 = await createTestMonsterAttack(sql, { isSpecial: true, chargeTurns: 1 });
    const special3 = await createTestMonsterAttack(sql, { isSpecial: true, chargeTurns: 1 });
    const uc = buildUseCases(sql, new FakeRng([1]));

    let threw = false;
    try {
      await uc.setDungeonBossSpecialAttacksUseCase.execute({
        dungeonBossId: bossId,
        attackIds: [special1, special2, special3],
      });
    } catch (err) {
      threw = true;
      expect(String(err)).toContain("already has 2 special attacks");
    }
    expect(threw).toBe(true);
  });
});
