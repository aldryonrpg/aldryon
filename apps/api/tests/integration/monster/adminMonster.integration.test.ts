import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { Monster } from "@/domain/monster/Monster";
import { PostgresMonsterAttackRepository } from "@/infrastructure/persistence/PostgresMonsterAttackRepository";
import { PostgresMonsterRepository } from "@/infrastructure/persistence/PostgresMonsterRepository";
import { DuplicateMonsterNameError, MonsterNotFoundError } from "@/usecase/monster/errors";
import { MonsterCatalogCache } from "@/usecase/monster/MonsterCatalogCache";
import { buildUseCases } from "../support/buildUseCases";
import { expectRejection } from "../support/expectRejection";
import { FakeRng } from "../support/FakeRng";
import { getSharedPostgresEnvironment } from "../support/sharedPostgresEnvironment";
import {
  createTestAdmin,
  createTestBattle,
  createTestMonster,
  createTestPlayer,
  createTestUser,
} from "../support/testFixtures";

const ATTRIBUTES = {
  strength: 5,
  dexterity: 5,
  agility: 5,
  intelligence: 5,
  vitality: 5,
  luck: 5,
};

describe("AdminRepository (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("returns true for a user with an admins row (happy path)", async () => {
    const userId = await createTestUser(sql);
    await createTestAdmin(sql, userId);
    const uc = buildUseCases(sql, new FakeRng([1]));

    expect(await uc.adminRepository.isAdmin(userId)).toBe(true);
  });

  it("returns false for a user with no admins row (edge case)", async () => {
    const userId = await createTestUser(sql);
    const uc = buildUseCases(sql, new FakeRng([1]));

    expect(await uc.adminRepository.isAdmin(userId)).toBe(false);
  });
});

describe("ListMonstersForAdminUseCase (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("returns every wild catalog monster, including a freshly created one (happy path)", async () => {
    const monsterId = await createTestMonster(sql, { region: "forest" });
    const uc = buildUseCases(sql, new FakeRng([1]));

    const monsters = await uc.listMonstersForAdminUseCase.execute();

    expect(monsters.some((m) => m.id === monsterId)).toBe(true);
  });

  it("excludes materialized dungeon-boss rows (edge case)", async () => {
    const materializedId = await createTestMonster(sql, {
      name: `Test Boss — Tier 1 ${Bun.randomUUIDv7()}`,
      region: "dungeon",
    });
    const uc = buildUseCases(sql, new FakeRng([1]));

    const monsters = await uc.listMonstersForAdminUseCase.execute();

    expect(monsters.some((m) => m.id === materializedId)).toBe(false);
  });
});

describe("CreateMonsterUseCase (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("creates a new monster (happy path)", async () => {
    const uc = buildUseCases(sql, new FakeRng([1]));
    const name = `Admin Created Monster ${Bun.randomUUIDv7()}`;

    const monster = await uc.createMonsterUseCase.execute({
      name,
      description: "created via admin",
      region: "ruins",
      monsterImage: "data:image/svg+xml,test",
      hp: 150,
      xpGain: 20,
      level: 3,
      maxStamina: 120,
      attributes: ATTRIBUTES,
      monsterType: "poisonous",
      drops: [],
      exclusiveDrops: [],
      legendaryDrops: [],
      ambushChance: 15,
    });

    expect(monster.name).toBe(name);
    expect(monster.hp).toBe(150);
    expect(monster.monsterType).toBe("poisonous");

    const persisted = await uc.monsterRepository.findById(monster.id);
    expect(persisted?.name).toBe(name);
  });

  it("rejects a duplicate monster name (edge case)", async () => {
    const existingId = await createTestMonster(sql);
    const existingRows = await sql`select name from monsters where id = ${existingId}`;
    const existingName = existingRows[0].name as string;
    const uc = buildUseCases(sql, new FakeRng([1]));

    await expectRejection(
      uc.createMonsterUseCase.execute({
        name: existingName,
        description: "duplicate attempt",
        region: "mountain",
        monsterImage: "data:image/svg+xml,test",
        hp: 100,
        xpGain: 10,
        level: 1,
        maxStamina: 100,
        attributes: ATTRIBUTES,
        monsterType: "normal",
        drops: [],
        exclusiveDrops: [],
        legendaryDrops: [],
        ambushChance: 0,
      }),
      DuplicateMonsterNameError,
    );
  });
});

describe("UpdateMonsterUseCase (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("patches a subset of fields and leaves the rest untouched (happy path)", async () => {
    const monsterId = await createTestMonster(sql, { hp: 100, level: 2 });
    const uc = buildUseCases(sql, new FakeRng([1]));

    const updated = await uc.updateMonsterUseCase.execute({ id: monsterId, hp: 999 });

    expect(updated.hp).toBe(999);
    expect(updated.level).toBe(2);
  });

  it("rejects patching a monster id that doesn't exist (edge case)", async () => {
    const uc = buildUseCases(sql, new FakeRng([1]));

    await expectRejection(
      uc.updateMonsterUseCase.execute({ id: Bun.randomUUIDv7(), hp: 999 }),
      MonsterNotFoundError,
    );
  });

  it("rejects renaming a monster to another monster's existing name (edge case)", async () => {
    const otherId = await createTestMonster(sql);
    const otherRows = await sql`select name from monsters where id = ${otherId}`;
    const otherName = otherRows[0].name as string;
    const monsterId = await createTestMonster(sql);
    const uc = buildUseCases(sql, new FakeRng([1]));

    await expectRejection(
      uc.updateMonsterUseCase.execute({ id: monsterId, name: otherName }),
      DuplicateMonsterNameError,
    );
  });

  it("evicts the monster from MonsterCatalogCache so a cached read sees the patched value immediately", async () => {
    const monsterId = await createTestMonster(sql, { hp: 100 });
    const uc = buildUseCases(sql, new FakeRng([1]));

    const cachedBeforePatch = await uc.monsterCatalogCache.getMonster(monsterId);
    expect(cachedBeforePatch?.hp).toBe(100);

    await uc.updateMonsterUseCase.execute({ id: monsterId, hp: 777 });

    const cachedAfterPatch = await uc.monsterCatalogCache.getMonster(monsterId);
    expect(cachedAfterPatch?.hp).toBe(777);
  });

  it("clamps monster_current_hp down on an active battle when hp is patched below it (edge case)", async () => {
    const monsterId = await createTestMonster(sql, { hp: 100 });
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId);
    const battleId = await createTestBattle(sql, playerId, monsterId, { monsterCurrentHp: 80 });
    const uc = buildUseCases(sql, new FakeRng([1]));

    await uc.updateMonsterUseCase.execute({ id: monsterId, hp: 50 });

    const rows = await sql`select monster_current_hp from battles where id = ${battleId}`;
    expect(rows[0].monster_current_hp).toBe(50);
  });

  it("never raises monster_current_hp when hp is patched upward (edge case)", async () => {
    const monsterId = await createTestMonster(sql, { hp: 100 });
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId);
    const battleId = await createTestBattle(sql, playerId, monsterId, { monsterCurrentHp: 80 });
    const uc = buildUseCases(sql, new FakeRng([1]));

    await uc.updateMonsterUseCase.execute({ id: monsterId, hp: 200 });

    const rows = await sql`select monster_current_hp from battles where id = ${battleId}`;
    expect(rows[0].monster_current_hp).toBe(80);
  });
});

describe("MonsterCatalogCache cross-replica invalidation sweep (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("self-evicts a stale cached monster once another process's write changes its updated_at", async () => {
    const monsterId = await createTestMonster(sql, { hp: 100 });
    const monsterRepository = new PostgresMonsterRepository(sql);
    const monsterAttackRepository = new PostgresMonsterAttackRepository(sql);
    // sweepIntervalMs: 0 stands in for "replica B checking on every read" so
    // the test doesn't have to wait out the real 60s production interval.
    const replicaA = new MonsterCatalogCache(monsterRepository, monsterAttackRepository, 0);
    const replicaB = new MonsterCatalogCache(monsterRepository, monsterAttackRepository, 0);

    expect((await replicaA.getMonster(monsterId))?.hp).toBe(100);
    expect((await replicaB.getMonster(monsterId))?.hp).toBe(100);

    // An admin PATCH lands on replica A: it writes the new row and evicts
    // its OWN cache — exactly what UpdateMonsterUseCase does — but has no
    // way to reach replica B's separate in-memory cache.
    const existing = await monsterRepository.findById(monsterId);
    if (!existing) throw new Error("test setup: monster not found");
    await monsterRepository.update(Monster.create({ ...existing.toProps(), hp: 250 }));
    replicaA.evict(monsterId);

    // Replica B's next read runs the sweep, notices updated_at moved since
    // it last saw this id, and self-evicts — no pub/sub layer involved.
    expect((await replicaB.getMonster(monsterId))?.hp).toBe(250);
  });
});
