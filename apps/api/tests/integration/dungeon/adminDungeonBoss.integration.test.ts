import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { DungeonBossNotFoundError, DuplicateDungeonBossNameError } from "@/usecase/dungeon/errors";
import { buildUseCases } from "../support/buildUseCases";
import { expectRejection } from "../support/expectRejection";
import { FakeRng } from "../support/FakeRng";
import { getSharedPostgresEnvironment } from "../support/sharedPostgresEnvironment";
import { createTestDungeonBoss } from "../support/testFixtures";

const BASE_ATTRIBUTES = {
  strength: 10,
  dexterity: 10,
  agility: 10,
  intelligence: 10,
  vitality: 10,
  luck: 10,
};

describe("ListDungeonBossesForAdminUseCase (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("returns every dungeon boss, including a freshly created one (happy path)", async () => {
    const bossId = await createTestDungeonBoss(sql);
    const uc = buildUseCases(sql, new FakeRng([1]));

    const bosses = await uc.listDungeonBossesForAdminUseCase.execute();

    expect(bosses.some((b) => b.id === bossId)).toBe(true);
  });
});

describe("CreateDungeonBossUseCase (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("creates a new dungeon boss (happy path)", async () => {
    const uc = buildUseCases(sql, new FakeRng([1]));
    const name = `Admin Created Boss ${Bun.randomUUIDv7()}`;

    const dungeonBoss = await uc.createDungeonBossUseCase.execute({
      name,
      description: "created via admin",
      monsterImage: "data:image/svg+xml,test",
      monsterType: "normal",
      baseHp: 2000,
      baseXpGain: 800,
      baseMaxStamina: 200,
      baseAttributes: BASE_ATTRIBUTES,
      drops: [],
      exclusiveDrops: [],
      legendaryDrops: [],
    });

    expect(dungeonBoss.name).toBe(name);
    expect(dungeonBoss.baseHp).toBe(2000);

    const persisted = await uc.dungeonBossRepository.findById(dungeonBoss.id);
    expect(persisted?.name).toBe(name);
  });

  it("rejects a duplicate dungeon boss name (edge case)", async () => {
    const existingId = await createTestDungeonBoss(sql);
    const existingRows = await sql`select name from dungeon_bosses where id = ${existingId}`;
    const existingName = existingRows[0].name as string;
    const uc = buildUseCases(sql, new FakeRng([1]));

    await expectRejection(
      uc.createDungeonBossUseCase.execute({
        name: existingName,
        description: "duplicate attempt",
        monsterImage: "data:image/svg+xml,test",
        monsterType: "normal",
        baseHp: 1000,
        baseXpGain: 500,
        baseMaxStamina: 150,
        baseAttributes: BASE_ATTRIBUTES,
        drops: [],
        exclusiveDrops: [],
        legendaryDrops: [],
      }),
      DuplicateDungeonBossNameError,
    );
  });
});

describe("UpdateDungeonBossUseCase (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("patches a subset of fields and leaves the rest untouched (happy path)", async () => {
    const bossId = await createTestDungeonBoss(sql);
    const uc = buildUseCases(sql, new FakeRng([1]));
    const before = await uc.dungeonBossRepository.findById(bossId);
    if (!before) throw new Error("test setup: dungeon boss not found");

    const updated = await uc.updateDungeonBossUseCase.execute({ id: bossId, baseHp: 9999 });

    expect(updated.baseHp).toBe(9999);
    expect(updated.name).toBe(before.name);
  });

  it("rejects patching a dungeon boss id that doesn't exist (edge case)", async () => {
    const uc = buildUseCases(sql, new FakeRng([1]));

    await expectRejection(
      uc.updateDungeonBossUseCase.execute({ id: Bun.randomUUIDv7(), baseHp: 9999 }),
      DungeonBossNotFoundError,
    );
  });

  it("rejects renaming a dungeon boss to another boss's existing name (edge case)", async () => {
    const otherId = await createTestDungeonBoss(sql);
    const otherRows = await sql`select name from dungeon_bosses where id = ${otherId}`;
    const otherName = otherRows[0].name as string;
    const bossId = await createTestDungeonBoss(sql);
    const uc = buildUseCases(sql, new FakeRng([1]));

    await expectRejection(
      uc.updateDungeonBossUseCase.execute({ id: bossId, name: otherName }),
      DuplicateDungeonBossNameError,
    );
  });
});
