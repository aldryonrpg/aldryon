import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { MonsterAttackNotFoundError, MonsterNotFoundError } from "@/usecase/monster/errors";
import { buildUseCases } from "../support/buildUseCases";
import { expectRejection } from "../support/expectRejection";
import { FakeRng } from "../support/FakeRng";
import { getSharedPostgresEnvironment } from "../support/sharedPostgresEnvironment";
import {
  createTestMonster,
  createTestMonsterAttack,
  linkMonsterMoveset,
} from "../support/testFixtures";

describe("GetMonsterNormalAttacksUseCase (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("returns only the monster's normal attack ids, not its specials (happy path)", async () => {
    const monsterId = await createTestMonster(sql);
    const normal1 = await createTestMonsterAttack(sql);
    const normal2 = await createTestMonsterAttack(sql);
    const special = await createTestMonsterAttack(sql, { isSpecial: true, chargeTurns: 1 });
    await linkMonsterMoveset(sql, monsterId, normal1);
    await linkMonsterMoveset(sql, monsterId, normal2);
    await linkMonsterMoveset(sql, monsterId, special);
    const uc = buildUseCases(sql, new FakeRng([1]));

    const ids = await uc.getMonsterNormalAttacksUseCase.execute(monsterId);

    expect(new Set(ids)).toEqual(new Set([normal1, normal2]));
  });

  it("returns an empty list for a monster with no normal attacks (edge case)", async () => {
    const monsterId = await createTestMonster(sql);
    const uc = buildUseCases(sql, new FakeRng([1]));

    const ids = await uc.getMonsterNormalAttacksUseCase.execute(monsterId);

    expect(ids).toEqual([]);
  });

  it("rejects a monster id that doesn't exist (edge case)", async () => {
    const uc = buildUseCases(sql, new FakeRng([1]));

    await expectRejection(
      uc.getMonsterNormalAttacksUseCase.execute(Bun.randomUUIDv7()),
      MonsterNotFoundError,
    );
  });
});

describe("SetMonsterNormalAttacksUseCase (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("links exactly the given normal attacks, unbounded count (happy path)", async () => {
    const monsterId = await createTestMonster(sql);
    const normal1 = await createTestMonsterAttack(sql);
    const normal2 = await createTestMonsterAttack(sql);
    const normal3 = await createTestMonsterAttack(sql);
    const uc = buildUseCases(sql, new FakeRng([1]));

    const result = await uc.setMonsterNormalAttacksUseCase.execute({
      monsterId,
      attackIds: [normal1, normal2, normal3],
    });

    expect(new Set(result)).toEqual(new Set([normal1, normal2, normal3]));
    const persisted = await uc.monsterAttackRepository.findMonsterNormalAttackIds(monsterId);
    expect(new Set(persisted)).toEqual(new Set([normal1, normal2, normal3]));
  });

  it("replaces a previous normal-attack set wholesale (happy path)", async () => {
    const monsterId = await createTestMonster(sql);
    const oldNormal = await createTestMonsterAttack(sql);
    const newNormal = await createTestMonsterAttack(sql);
    const uc = buildUseCases(sql, new FakeRng([1]));
    await uc.setMonsterNormalAttacksUseCase.execute({ monsterId, attackIds: [oldNormal] });

    await uc.setMonsterNormalAttacksUseCase.execute({ monsterId, attackIds: [newNormal] });

    const persisted = await uc.monsterAttackRepository.findMonsterNormalAttackIds(monsterId);
    expect(persisted).toEqual([newNormal]);
  });

  it("leaves the monster's special-attack links untouched (edge case)", async () => {
    const monsterId = await createTestMonster(sql);
    const special = await createTestMonsterAttack(sql, { isSpecial: true, chargeTurns: 1 });
    await linkMonsterMoveset(sql, monsterId, special);
    const normal = await createTestMonsterAttack(sql);
    const uc = buildUseCases(sql, new FakeRng([1]));

    await uc.setMonsterNormalAttacksUseCase.execute({ monsterId, attackIds: [normal] });

    const rows = await sql<
      { monster_attack_id: string }[]
    >`select monster_attack_id from monster_movesets where monster_id = ${monsterId}`;
    expect(new Set(rows.map((r) => r.monster_attack_id))).toEqual(new Set([special, normal]));
  });

  it("rejects a monster id that doesn't exist (edge case)", async () => {
    const uc = buildUseCases(sql, new FakeRng([1]));

    await expectRejection(
      uc.setMonsterNormalAttacksUseCase.execute({
        monsterId: Bun.randomUUIDv7(),
        attackIds: [],
      }),
      MonsterNotFoundError,
    );
  });

  it("rejects an attack id that doesn't exist (edge case)", async () => {
    const monsterId = await createTestMonster(sql);
    const uc = buildUseCases(sql, new FakeRng([1]));

    await expectRejection(
      uc.setMonsterNormalAttacksUseCase.execute({
        monsterId,
        attackIds: [Bun.randomUUIDv7()],
      }),
      MonsterAttackNotFoundError,
    );
  });

  it("rejects a special attack — specials are boss-only via this endpoint (edge case)", async () => {
    const monsterId = await createTestMonster(sql);
    const special = await createTestMonsterAttack(sql, { isSpecial: true, chargeTurns: 1 });
    const uc = buildUseCases(sql, new FakeRng([1]));

    await expectRejection(
      uc.setMonsterNormalAttacksUseCase.execute({ monsterId, attackIds: [special] }),
      Error,
    );
  });
});
