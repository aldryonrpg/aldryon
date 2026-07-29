import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { AttackNotFoundError, DuplicateAttackNameError } from "@/usecase/attack/errors";
import { buildUseCases } from "../support/buildUseCases";
import { expectRejection } from "../support/expectRejection";
import { FakeRng } from "../support/FakeRng";
import { getSharedPostgresEnvironment } from "../support/sharedPostgresEnvironment";
import { createTestPlayerAttack } from "../support/testFixtures";

const BASE_REQUIREMENTS = {
  strength: 1,
  dexterity: 1,
  agility: 1,
  intelligence: 1,
  vitality: 1,
  luck: 1,
};

describe("ListAttacksForAdminUseCase (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("returns every attack, including a freshly created one (happy path)", async () => {
    const attackId = await createTestPlayerAttack(sql);
    const uc = buildUseCases(sql, new FakeRng([1]));

    const attacks = await uc.listAttacksForAdminUseCase.execute();

    expect(attacks.some((a) => a.id === attackId)).toBe(true);
  });
});

describe("CreateAttackUseCase (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("creates a new attack (happy path)", async () => {
    const uc = buildUseCases(sql, new FakeRng([1]));
    const name = `Admin Created Attack ${Bun.randomUUIDv7()}`;

    const attack = await uc.createAttackUseCase.execute({
      name,
      staminaCost: 15,
      multiplier: 1.5,
      scalingAttribute: "strength",
      minLevel: 3,
      attributeRequirements: { ...BASE_REQUIREMENTS, strength: 10 },
      revealsRandomMonsterAttribute: false,
    });

    expect(attack.name).toBe(name);
    expect(attack.staminaCost).toBe(15);
    expect(attack.multiplier).toBe(1.5);
    expect(attack.minLevel).toBe(3);
    expect(attack.attributeRequirements.strength).toBe(10);
    // appliesEffect is never admin-settable — CreateAttackUseCase always creates null here.
    expect(attack.appliesEffect).toBeNull();

    const persisted = await uc.attackRepository.findById(attack.id);
    expect(persisted?.name).toBe(name);
  });

  it("rejects a duplicate attack name (edge case)", async () => {
    const existingId = await createTestPlayerAttack(sql);
    const existingRows = await sql`select name from attacks where id = ${existingId}`;
    const existingName = existingRows[0].name as string;
    const uc = buildUseCases(sql, new FakeRng([1]));

    await expectRejection(
      uc.createAttackUseCase.execute({
        name: existingName,
        staminaCost: 0,
        multiplier: 1,
        scalingAttribute: "strength",
        minLevel: 1,
        attributeRequirements: BASE_REQUIREMENTS,
        revealsRandomMonsterAttribute: false,
      }),
      DuplicateAttackNameError,
    );
  });
});

describe("UpdateAttackUseCase (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("patches a subset of fields and leaves the rest untouched (happy path)", async () => {
    const attackId = await createTestPlayerAttack(sql, { staminaCost: 5, minLevel: 1 });
    const uc = buildUseCases(sql, new FakeRng([1]));
    const before = await uc.attackRepository.findById(attackId);
    if (!before) throw new Error("test setup: attack not found");

    const updated = await uc.updateAttackUseCase.execute({
      id: attackId,
      staminaCost: 40,
      minLevel: 5,
    });

    expect(updated.staminaCost).toBe(40);
    expect(updated.minLevel).toBe(5);
    expect(updated.name).toBe(before.name);
  });

  it("rejects patching an attack id that doesn't exist (edge case)", async () => {
    const uc = buildUseCases(sql, new FakeRng([1]));

    await expectRejection(
      uc.updateAttackUseCase.execute({ id: Bun.randomUUIDv7(), staminaCost: 10 }),
      AttackNotFoundError,
    );
  });

  it("rejects renaming an attack to another attack's existing name (edge case)", async () => {
    const otherId = await createTestPlayerAttack(sql);
    const otherRows = await sql`select name from attacks where id = ${otherId}`;
    const otherName = otherRows[0].name as string;
    const attackId = await createTestPlayerAttack(sql);
    const uc = buildUseCases(sql, new FakeRng([1]));

    await expectRejection(
      uc.updateAttackUseCase.execute({ id: attackId, name: otherName }),
      DuplicateAttackNameError,
    );
  });

  it("refreshes the repository's whole-table cache so a cached read sees the patched value immediately", async () => {
    const attackId = await createTestPlayerAttack(sql, { staminaCost: 20 });
    const uc = buildUseCases(sql, new FakeRng([1]));

    const cachedBeforePatch = await uc.attackRepository.findById(attackId);
    expect(cachedBeforePatch?.staminaCost).toBe(20);

    await uc.updateAttackUseCase.execute({ id: attackId, staminaCost: 99 });

    const cachedAfterPatch = await uc.attackRepository.findById(attackId);
    expect(cachedAfterPatch?.staminaCost).toBe(99);
  });
});
