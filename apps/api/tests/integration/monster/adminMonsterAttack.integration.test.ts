import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import {
  DuplicateMonsterAttackNameError,
  MonsterAttackNotFoundError,
} from "@/usecase/monster/errors";
import { buildUseCases } from "../support/buildUseCases";
import { expectRejection } from "../support/expectRejection";
import { FakeRng } from "../support/FakeRng";
import { getSharedPostgresEnvironment } from "../support/sharedPostgresEnvironment";
import { createTestMonsterAttack } from "../support/testFixtures";

describe("ListMonsterAttacksForAdminUseCase (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("returns every monster attack, including a freshly created one (happy path)", async () => {
    const monsterAttackId = await createTestMonsterAttack(sql);
    const uc = buildUseCases(sql, new FakeRng([1]));

    const monsterAttacks = await uc.listMonsterAttacksForAdminUseCase.execute();

    expect(monsterAttacks.some((a) => a.id === monsterAttackId)).toBe(true);
  });
});

describe("CreateMonsterAttackUseCase (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("creates a new monster attack (happy path)", async () => {
    const uc = buildUseCases(sql, new FakeRng([1]));
    const name = `Admin Created Monster Attack ${Bun.randomUUIDv7()}`;

    const monsterAttack = await uc.createMonsterAttackUseCase.execute({
      name,
      staminaCost: 10,
      multiplier: 1.2,
      scalingAttribute: "strength",
      appliesEffect: "bleed",
      isSpecial: false,
      chargeTurns: 0,
    });

    expect(monsterAttack.name).toBe(name);
    expect(monsterAttack.staminaCost).toBe(10);
    expect(monsterAttack.multiplier).toBe(1.2);
    expect(monsterAttack.appliesEffect).toBe("bleed");
    expect(monsterAttack.isSpecial).toBe(false);

    const persisted = await uc.monsterAttackRepository.findById(monsterAttack.id);
    expect(persisted?.name).toBe(name);
  });

  it("creates a special attack requiring chargeTurns >= 1 (happy path)", async () => {
    const uc = buildUseCases(sql, new FakeRng([1]));
    const name = `Admin Created Special ${Bun.randomUUIDv7()}`;

    const monsterAttack = await uc.createMonsterAttackUseCase.execute({
      name,
      staminaCost: 30,
      multiplier: 3,
      scalingAttribute: "intelligence",
      appliesEffect: "fear",
      isSpecial: true,
      chargeTurns: 2,
    });

    expect(monsterAttack.isSpecial).toBe(true);
    expect(monsterAttack.chargeTurns).toBe(2);
  });

  it("rejects a special attack with chargeTurns 0 (edge case)", async () => {
    const uc = buildUseCases(sql, new FakeRng([1]));

    await expectRejection(
      uc.createMonsterAttackUseCase.execute({
        name: `Invalid Special ${Bun.randomUUIDv7()}`,
        staminaCost: 10,
        multiplier: 1,
        scalingAttribute: "strength",
        appliesEffect: null,
        isSpecial: true,
        chargeTurns: 0,
      }),
      Error,
    );
  });

  it("rejects a duplicate monster attack name (edge case)", async () => {
    const existingId = await createTestMonsterAttack(sql);
    const existingRows = await sql`select name from monster_attacks where id = ${existingId}`;
    const existingName = existingRows[0].name as string;
    const uc = buildUseCases(sql, new FakeRng([1]));

    await expectRejection(
      uc.createMonsterAttackUseCase.execute({
        name: existingName,
        staminaCost: 0,
        multiplier: 1,
        scalingAttribute: "strength",
        appliesEffect: null,
        isSpecial: false,
        chargeTurns: 0,
      }),
      DuplicateMonsterAttackNameError,
    );
  });
});

describe("UpdateMonsterAttackUseCase (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("patches a subset of fields and leaves the rest untouched (happy path)", async () => {
    const monsterAttackId = await createTestMonsterAttack(sql, { staminaCost: 5 });
    const uc = buildUseCases(sql, new FakeRng([1]));
    const before = await uc.monsterAttackRepository.findById(monsterAttackId);
    if (!before) throw new Error("test setup: monster attack not found");

    const updated = await uc.updateMonsterAttackUseCase.execute({
      id: monsterAttackId,
      staminaCost: 40,
    });

    expect(updated.staminaCost).toBe(40);
    expect(updated.name).toBe(before.name);
  });

  it("rejects patching a monster attack id that doesn't exist (edge case)", async () => {
    const uc = buildUseCases(sql, new FakeRng([1]));

    await expectRejection(
      uc.updateMonsterAttackUseCase.execute({ id: Bun.randomUUIDv7(), staminaCost: 10 }),
      MonsterAttackNotFoundError,
    );
  });

  it("rejects renaming a monster attack to another monster attack's existing name (edge case)", async () => {
    const otherId = await createTestMonsterAttack(sql);
    const otherRows = await sql`select name from monster_attacks where id = ${otherId}`;
    const otherName = otherRows[0].name as string;
    const monsterAttackId = await createTestMonsterAttack(sql);
    const uc = buildUseCases(sql, new FakeRng([1]));

    await expectRejection(
      uc.updateMonsterAttackUseCase.execute({ id: monsterAttackId, name: otherName }),
      DuplicateMonsterAttackNameError,
    );
  });

  it("rejects patching isSpecial to true without also raising chargeTurns (edge case)", async () => {
    const monsterAttackId = await createTestMonsterAttack(sql, {
      isSpecial: false,
      chargeTurns: 0,
    });
    const uc = buildUseCases(sql, new FakeRng([1]));

    await expectRejection(
      uc.updateMonsterAttackUseCase.execute({ id: monsterAttackId, isSpecial: true }),
      Error,
    );
  });
});
